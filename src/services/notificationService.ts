import cron from 'node-cron';
import { UserPreferenceModel } from '../models/UserPreference';
import { ScheduleParser } from './scheduleParser';
import TelegramBot from 'node-telegram-bot-api';
import { Schedule } from '../types';
import axios from 'axios';
import { load } from 'cheerio';
import iconv from 'iconv-lite';
import { MessageManager } from '../services/messageManager';

export class NotificationService {
  private bot: TelegramBot;
  private scheduleParser: ScheduleParser;
  private messageManager: MessageManager;
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
    this.initializeNotifications();
  }

  private initializeNotifications(): void {
    cron.schedule('* * * * *', async () => {
      await this.checkForUpdate();
    }, {
      timezone: 'Europe/Moscow'
    });
  }

  private async checkForUpdate(): Promise<void> {
    try {
      const response = await axios.get("https://dmitrov.politeh-mo.ru/rasp/hg.htm", {
        timeout: 10000,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        validateStatus: (status) => status === 200
      });

      const html = iconv.decode(Buffer.from(response.data), 'win1251');
      const $ = load(html);
      const updatedText = $('.ref').text();      
     
      const match = updatedText.match(/Обновлено: (\d{2})\.(\d{2})\.(\d{4}) в (\d{2}):(\d{2})/);
      if (match && match[0]) {
        const currentUpdateTime = match[0];
        if (this.lastUpdateTime && this.lastUpdateTime !== currentUpdateTime) {
          console.log('Update time has changed, sending notifications');
          await this.sendDailyNotifications();
        }
        this.lastUpdateTime = currentUpdateTime;
      }
    } catch (error) {
      console.error('Ошибка при проверке страницы:', error);
    }
  }

  private async sendDailyNotifications(): Promise<void> {
    try {
      const users = await UserPreferenceModel.find({ notifications: true });
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      for (const user of users) {
        try {
          const schedule = await this.scheduleParser.fetchSchedule(user.groupId, tomorrow);
          const message = this.formatScheduleNotification(schedule);
          
          // Определяем типизированные опции сообщения
          const messageOptions: TelegramBot.SendMessageOptions = {
            parse_mode: 'HTML' as TelegramBot.ParseMode,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "⬅️ Предыдущий день", callback_data: "prev_day" },
                  { text: "Следующий день ➡️", callback_data: "next_day" }
                ]
              ]
            }
          };

          // Добавляем основную клавиатуру через отдельное свойство в reply_markup
          const replyMarkup = messageOptions.reply_markup as TelegramBot.ReplyKeyboardMarkup & {
            inline_keyboard: TelegramBot.InlineKeyboardButton[][];
          };

          replyMarkup.keyboard = [
            [{ text: "📅 Расписание" }, { text: "📆 Выбрать дату" }],
            [{ text: "👥 Сменить группу" }, { text: "🔔 Уведомления" }]
          ];
          replyMarkup.resize_keyboard = true;          

          // Отправляем сообщение
          const sentMessage = await this.bot.sendMessage(user.chatId, message, messageOptions);

          // Управляем историей сообщений
          if (sentMessage) {
            await this.messageManager.addBotMessage(this.bot, user.chatId, sentMessage.message_id);
          }
        } catch (error) {
          console.error(`Error sending notification to chat ${user.chatId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in notification service:', error);
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
}