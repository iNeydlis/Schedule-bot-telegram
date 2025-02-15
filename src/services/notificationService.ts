import cron from 'node-cron';
import { UserPreferenceModel } from '../models/UserPreference';
import { ScheduleParser } from './scheduleParser';
import TelegramBot from 'node-telegram-bot-api';
import { Schedule, UserPreference } from '../types';
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
  private isFirstRun: boolean = true;  
  private scheduledTimer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private userTimers: Map<number, NodeJS.Timeout> = new Map();
  private updateDebounceTimer: NodeJS.Timeout | null = null;
private pendingUpdateTime: string | null = null;
private useTestTime = process.env.TIME_TEST?.toLowerCase() === 'true';
  
  private readonly mainKeyboard = {
    keyboard: [
      [{ text: "📅 Расписание" }, { text: "📆 Выбрать дату" }],
      [{ text: "👥 Сменить группу" }, { text: "🔔 Уведомления" }],
      [{ text: "👤 Статистика" }, { text: "📋 Другая группа" }],
      [{ text: "✍️ Обратная связь" }]
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
    this.initializeUserPreferencesListener();

    cron.schedule('0 0 * * *', async () => {
      await this.cleanupInactiveUsers();
    }, {
      timezone: 'Europe/Moscow'
    });
  }

  private async initializeUserPreferencesListener(): Promise<void> {
    try {
      let lastTimeValues = new Map<number, string>();
      
      setInterval(async () => {
        try {
          const preferences = await UserPreferenceModel.find({});
   
          for (const pref of preferences) {
            const lastTime = lastTimeValues.get(pref.chatId);
            if (lastTime !== pref.notificationTime) {
              console.log(`Notification time changed for user ${pref.chatId}: ${pref.notificationTime}`);
              await this.modifyExistingTimer(pref);
              lastTimeValues.set(pref.chatId, pref.notificationTime);
            }
          }
        } catch (error) {
          console.error('Error checking for updates:', error);
        }
      }, 5000);
   
    } catch (error) {
      console.error('Error initializing preference listener:', error);
    }
   }

   private async processUpdate(newUpdateTime: string): Promise<void> {
    
    this.pendingUpdateTime = newUpdateTime;   
   
    if (this.updateDebounceTimer) {
      clearTimeout(this.updateDebounceTimer);
      console.log('Reset debounce timer due to new update');
    } else {
      console.log('Setting debounce timer for first update');
    }
    
    this.updateDebounceTimer = setTimeout(() => {
      console.log('Debounce period ended, clearing cache and sending notifications');
     
      this.lastUpdateTime = this.pendingUpdateTime!;
      this.pendingUpdateTime = null;
      this.updateDebounceTimer = null;
      console.log("Starting to clear cache...");
      this.cacheService.clearAllScheduleCaches();
      
      this.scheduleNotificationsForAllUsers().catch(err => {
        console.error('Error sending notifications:', err);
      });
    }, 10000);
  }
   
   private async modifyExistingTimer(user: UserPreference): Promise<void> {
    const existingTimer = this.userTimers.get(user.chatId);
    if (!existingTimer) {
      return;
    }

    clearTimeout(existingTimer);
    this.userTimers.delete(user.chatId);
  
    const [prefHour, prefMinute] = user.notificationTime.split(':').map(Number);
    const now = new Date();
    const scheduledTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      prefHour,
      prefMinute,
      0
    );
  
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
  
    if (currentHour > prefHour || (currentHour === prefHour && currentMinute >= prefMinute)) {
      console.log(`After ${user.notificationTime} - checking and sending notifications immediately for user ${user.chatId}`);
      await this.checkAndSendNotificationsForUser(user);
      return;
    }
  
    const timeUntilScheduled = scheduledTime.getTime() - now.getTime();
    if (timeUntilScheduled <= 0) return;
  
    console.log(`Scheduling notification for user ${user.chatId} at ${user.notificationTime}`);
  
    const timer = setTimeout(async () => {
      try {
        await this.checkAndSendNotificationsForUser(user);
      } catch (error) {
        console.error(`Error sending scheduled notification for user ${user.chatId}:`, error);
      } finally {
        this.userTimers.delete(user.chatId);
      }
    }, timeUntilScheduled);
  
    this.userTimers.set(user.chatId, timer);
    console.log(`Timer changed for user ${user.chatId}`);
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
    if (this.isProcessing) {
      console.log('Previous check still in progress - skipping');
      return;
    }
    
    this.isProcessing = true;
    
    try {
      let updatedText: string;

      if (this.useTestTime) {
        // Генерируем новое время для тестов
        const now = new Date();
        const day = now.getDate().toString().padStart(2, '0');
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const year = now.getFullYear();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        
        updatedText = `Обновлено: ${day}.${month}.${year} в ${hours}:${minutes}`;
        console.log(`Using test time: ${updatedText}`);
      } else {

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
      updatedText = $('.ref').text();
    }
      const match = updatedText.match(/Обновлено: (\d{2})\.(\d{2})\.(\d{4}) в (\d{2}):(\d{2})/);
      
      if (!match?.[0]) return;
      
      const currentUpdateTime = match[0];
      
      if (this.isFirstRun) {
        console.log('First run detected - saving initial state');
        this.lastUpdateTime = currentUpdateTime;
        this.isFirstRun = false;
        console.log(`Current update time: ${this.lastUpdateTime}`);
        return;
      }
      
      if (this.lastUpdateTime === currentUpdateTime) return;
      
      console.log('New update detected');
    console.log(`Previous update time: ${this.lastUpdateTime}`);
    console.log(`Current update time: ${currentUpdateTime}`);
    
    await this.processUpdate(currentUpdateTime);
      
    } catch (error) {
      console.error('Ошибка при проверке страницы:', error);
    } finally {
      this.isProcessing = false;
    }
  }
  
  private async scheduleNotificationsForAllUsers(): Promise<void> {
    const users = await UserPreferenceModel.find({ notifications: true });
    
    for (const user of users) {
      await this.scheduleNotificationForUser(user);
    }
  }
  
  private async scheduleNotificationForUser(user: UserPreference): Promise<void> {
    const existingTimer = this.userTimers.get(user.chatId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.userTimers.delete(user.chatId);
    }
    
    const [prefHour, prefMinute] = user.notificationTime.split(':').map(Number);
    const now = new Date();
    const scheduledTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      prefHour,
      prefMinute,
      0
    );
    
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    if (currentHour > prefHour || (currentHour === prefHour && currentMinute >= prefMinute)) {
      console.log(`After ${user.notificationTime} - checking and sending notifications immediately for user ${user.chatId}`);
      await this.checkAndSendNotificationsForUser(user);
      return;
    }
    
    const timeUntilScheduled = scheduledTime.getTime() - now.getTime();
    if (timeUntilScheduled <= 0) return;
    
    console.log(`Scheduling notification for user ${user.chatId} at ${user.notificationTime}`);
    
    const timer = setTimeout(async () => {
      try {
        await this.checkAndSendNotificationsForUser(user);
      } catch (error) {
        console.error(`Error sending scheduled notification for user ${user.chatId}:`, error);
      } finally {
        this.userTimers.delete(user.chatId);
      }
    }, timeUntilScheduled);
    
    this.userTimers.set(user.chatId, timer);
    console.log(`Notification scheduled for ${user.notificationTime} (in ${Math.round(timeUntilScheduled/1000/60)} minutes)`);
  }

  private async checkAndSendNotificationsForUser(user: any): Promise<void> {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const schedule = await this.scheduleParser.fetchSchedule(user.groupId, tomorrow);
      const newScheduleHash = this.generateScheduleHash(schedule);
      const previousHash = this.cacheService.getScheduleHash(user.chatId, tomorrow);

      if (previousHash !== newScheduleHash) {
        console.log(`Sending notification to ${user.chatId} due to schedule changes`);
        await this.sendNotification(user.chatId, schedule);
        this.cacheService.setScheduleHash(user.chatId, tomorrow, newScheduleHash);
      }
    } catch (error) {
      console.error(`Error processing schedule for chat ${user.chatId}:`, error);
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