import cron from 'node-cron';
import { UserPreferenceModel } from '../models/UserPreference';
import { ScheduleParser } from './scheduleParser';
import TelegramBot from 'node-telegram-bot-api';
import { Schedule } from '../types';
import axios from 'axios';
import { load } from 'cheerio';
import iconv from 'iconv-lite';
import { MessageManager } from '../services/messageManager';
import { CacheService } from './cacheService';
import crypto from 'crypto';

export class NotificationService {
  private bot: TelegramBot;
  private scheduleParser: ScheduleParser;
  private messageManager: MessageManager;
  private cacheService: CacheService;
  private lastUpdateTime: string | null = null;
  
  private readonly mainKeyboard = {
    keyboard: [
      [{ text: "📅 Расписание" }, { text: "📆 Выбрать дату" }],
      [{ text: "👥 Сменить группу" }, { text: "🔔 Уведомления" }]
    ],
    resize_keyboard: true,
    persistent: true
  };

  constructor(bot: TelegramBot, messageManager: MessageManager) {
    this.bot = bot;
    this.scheduleParser = new ScheduleParser();
    this.messageManager = messageManager;
    this.cacheService = CacheService.getInstance();
    this.initializeNotifications();
    
    cron.schedule('0 0 * * *', async () => {
      await this.cleanupInactiveUsers();
    }, {
      timezone: 'Europe/Moscow'
    });
  }

  private initializeNotifications(): void {
    cron.schedule('* * * * *', async () => {
      await this.checkForUpdate();
    }, {
      timezone: 'Europe/Moscow'
    });
  }

  private generateScheduleHash(schedule: Schedule): string {
    const scheduleString = JSON.stringify(schedule.lessons);
    return crypto.createHash('md5').update(scheduleString).digest('hex');
  }

  private async checkForUpdate(): Promise<void> {
    try {
      const response = await this.retry(() => 
        axios.get("https://dmitrov.politeh-mo.ru/rasp/hg.htm", {
          timeout: 10000,
          responseType: 'arraybuffer',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
          }
        })
      );

      const html = iconv.decode(Buffer.from(response.data), 'win1251');
      const $ = load(html);
      const updatedText = $('.ref').text();      
     
      const match = updatedText.match(/Обновлено: (\d{2})\.(\d{2})\.(\d{4}) в (\d{2}):(\d{2})/);
      if (match && match[0]) {
        const currentUpdateTime = match[0];
        if (this.lastUpdateTime && this.lastUpdateTime !== currentUpdateTime) {
          console.log(`Update detected: ${currentUpdateTime}`);          
          await this.checkAndSendNotifications();
        }
        this.lastUpdateTime = currentUpdateTime;
      }
    } catch (error) {
      console.error('Ошибка при проверке страницы:', error);
    }
  }

  private async checkAndSendNotifications(): Promise<void> {
    try {
      const users = await UserPreferenceModel.find({ notifications: true });
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      for (const user of users) {
        try {
          const schedule = await this.scheduleParser.fetchSchedule(user.groupId, tomorrow);
          const newScheduleHash = this.generateScheduleHash(schedule);
          const previousHash = this.cacheService.getScheduleHash(user.chatId, tomorrow);

          console.log(`Schedule check for user ${user.chatId}:`, {
            hasSchedule: schedule.lessons.length > 0,
            lessonsCount: schedule.lessons.length,
            previousHashExists: !!previousHash,
            hashesMatch: previousHash === newScheduleHash
          });          
          
          if ((!previousHash && schedule.lessons.length > 0) || 
              (previousHash && previousHash !== newScheduleHash)) {
            console.log(`Sending notification to ${user.chatId} due to schedule changes`);
            await this.sendNotification(user.chatId, schedule);
            this.cacheService.setScheduleHash(user.chatId, tomorrow, newScheduleHash);
          } else {
            console.log(`No significant changes for chat ${user.chatId}`);
          }
        } catch (error) {
          if (error instanceof Error) {
            console.error(`Error processing schedule for chat ${user.chatId}:`, {
              error: error.message,
              stack: error.stack
            });
          } else {
            console.error(`Unknown error for chat ${user.chatId}:`, error);
          }         
        }
      }
    } catch (error) {
      console.error('Error in notification service:', error);
    }
  }

  private async retry<T>(operation: () => Promise<T>, retries: number = 3): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0) {
        console.log(`Retrying operation, ${retries} attempts left`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return this.retry(operation, retries - 1);
      }
      throw error;
    }
  }

  private async sendNotification(chatId: number, schedule: Schedule): Promise<void> {
    try {
      // Проверяем существование чата перед отправкой
      const me = await this.bot.getMe();
      await this.bot.getChatMember(chatId, me.id);
      
      const message = this.formatScheduleNotification(schedule);
      const messageOptions: TelegramBot.SendMessageOptions = {
        parse_mode: 'HTML',
        reply_markup: {
          ...this.mainKeyboard,
          inline_keyboard: [
            [
              { text: "⬅️ Предыдущий день", callback_data: "prev_day" },
              { text: "Следующий день ➡️", callback_data: "next_day" }
            ]
          ]
        }
      };

      const sentMessage = await this.bot.sendMessage(chatId, message, messageOptions);

      if (sentMessage) {
        await this.messageManager.addBotMessage(this.bot, chatId, sentMessage.message_id);
      }
    } catch (error: any) {
      if (error.code === 'ETELEGRAM') {
        const errorMessage = error.response?.body?.description || error.message;
        
        if (
          errorMessage.includes('chat not found') ||
          errorMessage.includes('bot was blocked') ||
          errorMessage.includes('user is deactivated') ||
          errorMessage.includes('bot was kicked')
        ) {
          console.log(`Deactivating notifications for user ${chatId} due to: ${errorMessage}`);
          
          await UserPreferenceModel.findOneAndUpdate(
            { chatId },
            { notifications: false },
            { new: true }
          );
          
          this.cacheService.clearUserCache(chatId);
        }
      }
      throw error;
    }
  }

  private formatScheduleNotification(schedule: Schedule): string {
    const hasLessons = schedule.lessons && Array.isArray(schedule.lessons) && schedule.lessons.length > 0;
   
    let message = `🔔 Уведомление о расписании\n`;
    message += `📅 <b>${schedule.date} (${schedule.dayOfWeek})</b>\n\n`;
   
    if (!hasLessons) {
      message += '📢 <i>На завтра занятия не найдены</i>\n';
      return message;
    }

    const defaultLessons = [
      { time: "8:30-10:00", number: 1 },
      { time: "10:10-11:40", number: 2 },
      { time: "12:10-13:40", number: 3 },
      { time: "13:50-15:20", number: 4 },
      { time: "15:30-17:00", number: 5 },
      { time: "17:10-18:40", number: 6 }
    ];

    defaultLessons.forEach(defaultLesson => {
      const lesson = schedule.lessons?.find(l => l.number === defaultLesson.number);
     
      message += `${defaultLesson.number}. ⏰ <b>${defaultLesson.time}</b>\n`;
     
      if (lesson) {
        message += `📚 ${lesson.subject}\n`;
        message += `👩‍🏫 ${lesson.teacher}\n`;
        message += `🏫 Аудитория: ${lesson.room}\n`;
      } else {
        message += `❌ Нет пары\n`;
      }
      message += '\n';
    });

    message += `\n<i>Обновлено: ${new Date().toLocaleTimeString()}</i>`;
    return message;
  }

  private async isChatActive(chatId: number): Promise<boolean> {
    try {
      const me = await this.bot.getMe();
      await this.bot.getChatMember(chatId, me.id);
      return true;
    } catch (error) {
      return false;
    }
  }

  public async cleanupInactiveUsers(): Promise<void> {
    try {
      const users = await UserPreferenceModel.find({ notifications: true });
      
      for (const user of users) {
        const isActive = await this.isChatActive(user.chatId);
        
        if (!isActive) {
          console.log(`Deactivating notifications for inactive user: ${user.chatId}`);
          await UserPreferenceModel.findOneAndUpdate(
            { chatId: user.chatId },
            { notifications: false },
            { new: true }
          );
          this.cacheService.clearUserCache(user.chatId);
        }
      }
    } catch (error) {
      console.error('Error during inactive users cleanup:', error);
    }
  }
}