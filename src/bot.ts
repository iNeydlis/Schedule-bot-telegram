import TelegramBot from 'node-telegram-bot-api';
import { ScheduleParser } from './services/scheduleParser';
import { NotificationService } from './services/notificationService';
import { UserPreferenceModel } from './models/UserPreference';
import { Schedule, Lesson } from './types';
import { groupMap } from './groupMap';
import { MessageManager } from './services/messageManager';
import { TimeInputHandler } from './models/TimeInputHandler';

const VERSION = '0.9.4 BETA';

export class ScheduleBot {
  private bot: TelegramBot;
  private scheduleParser: ScheduleParser;
  private notificationService: NotificationService;
  private messageManager: MessageManager;
  private dateMap: Map<number, Date>;
  private userSelectedDates: Set<number>;
  private readonly mainKeyboard = {
    keyboard: [
      [{ text: "📅 Расписание" }, { text: "📆 Выбрать дату" }],
      [{ text: "👥 Сменить группу" }, { text: "🔔 Уведомления" }],
      [{ text: "👤 Статистика" }, { text: "📋 Другая группа" }]
    ],
    resize_keyboard: true,
    persistent: true
  };

  private botId: number | null = null;
  private botUsername: string | null = null;

  constructor(token: string) {
    this.bot = new TelegramBot(token, {
      polling: {
        interval: 300,
        params: {
          timeout: 30
        }
      }
    });
    this.scheduleParser = new ScheduleParser();
    this.messageManager = new MessageManager();
    this.notificationService = new NotificationService(this.bot, this.messageManager);
    this.dateMap = new Map();
    this.userSelectedDates = new Set();

    // Инициализируем информацию о боте
    this.bot.getMe().then(botInfo => {
      this.botId = botInfo.id;
      this.botUsername = botInfo.username || null; // Явно приводим undefined к null
      console.log('Bot initialized with ID:', this.botId, 'Username:', this.botUsername);
    });


    this.initializeHandlers();
    this.setupMainMenu();

    this.bot.on('polling_error', (error) => {
      console.error('Polling error:', error.message);
      if (error.message.includes('ETELEGRAM: 409 Conflict')) {
        process.exit(1);
      }
    });
  }
  private async sendBotMessage(chatId: number, text: string, options: any = {}): Promise<void> {
    try {
      // Если reply_markup уже есть в options, используем его как есть
      // В противном случае используем основную клавиатуру
      const messageOptions = {
        parse_mode: 'HTML',
        ...options,
        reply_markup: options.reply_markup || this.mainKeyboard
      };

      const message = await this.bot.sendMessage(chatId, text, messageOptions);
      await this.messageManager.addBotMessage(this.bot, chatId, message.message_id);
    } catch (error) {
      console.error('Error sending message:', error);
      await this.bot.sendMessage(chatId, 'Произошла ошибка при отправке сообщения. Попробуйте позже.');
    }
  }


  private setupMainMenu(): void {
    const keyboard = {
      keyboard: [
        [{ text: "📅 Расписание" }, { text: "📆 Выбрать дату" }],
        [{ text: "👥 Сменить группу" }, { text: "🔔 Уведомления" }]
      ],
      resize_keyboard: true,
      persistent: true
    };

    this.bot.setMyCommands([
      { command: '/start', description: 'Начать работу с ботом' },
      { command: '/schedule', description: 'Показать расписание' },
      { command: '/other', description: 'Посмотреть расписание другой группы' },
      { command: '/notifications', description: 'Управление уведомлениями' },
      { command: '/stats', description: 'Показать статистику бота' },
      { command: '/help', description: 'Помощь по использованию бота' }
    ]);
  }

  private initializeHandlers(): void {
    // Обработка всех типов сообщений
    this.bot.on('message', async (msg) => {
      const userId = msg.from?.id;
      if (!userId) return;

      if (!this.messageManager.shouldProcessCommand(userId)) {
        return;
      }

      if (msg.text) {
        await this.handleMessage(msg);
      }
    });


    // Обработка добавления бота в группу
    this.bot.on('new_chat_members', async (msg) => {
      const newMembers = msg.new_chat_members;
      if (!newMembers) return;

      for (const member of newMembers) {
        if (member.id === this.botId) {
          await this.handleStart(msg);
          break;
        }
      }
    });

    this.bot.on('callback_query', this.handleCallbackQuery.bind(this));
  }

  private async handleMessage(msg: TelegramBot.Message): Promise<void> {
    const text = msg.text;
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const isGroupChat = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    const isCommand = text?.startsWith('/');
    const mentionsBot = text && this.botUsername ? text.includes(`@${this.botUsername}`) : false;


    if (!text || !userId) return;
    const currentState = await this.messageManager.getState(chatId);

    if (currentState === 'awaiting_time') {
      await this.handleTimeMessage(chatId, text);
      await this.messageManager.setState(chatId, null);
      return;
    }

    if (isGroupChat) {
      const isReplyToBot = msg.reply_to_message?.from?.id === this.botId;

      if (!isCommand && !mentionsBot && !isReplyToBot) {
        return;
      }

      const cleanText = this.botUsername && mentionsBot
        ? text.replace(`@${this.botUsername}`, '').trim()
        : text.trim();


      switch (cleanText) {
        case '/start':
          await this.handleStart(msg);
          break;
        case '/schedule':
        case '📅 Расписание':
          await this.handleSchedule(msg);
          break;
        case '/other':
        case '📋 Другая группа':
          await this.handleOtherSchedule(msg);
          break;
        case '/stats':
        case '👤 Статистика':
          await this.handleStats(msg);
          break;
        case '/notifications':
        case '🔔 Уведомления':
          await this.handleNotifications(msg);
          break;
        case '/help':
          await this.handleHelp(msg);
          break;
        case '📆 Выбрать дату':
          await this.sendDateSelection(chatId);
          break;
        case '👥 Сменить группу':
          await this.sendGroupSelection(chatId, userId, isGroupChat);
          break;
        default:
          if (this.isGroupInput(cleanText)) {
            const state = await this.messageManager.getState(chatId);
            if (state === 'awaiting_other_group') {
              await this.handleOtherGroupSchedule(msg, cleanText);
            } else {
              await this.handleGroupInput(msg, cleanText);
            }

          }
          else if (currentState === 'awaiting_time') {
            await this.handleTimeMessage(chatId, text);
            await this.messageManager.setState(chatId, null);
          }
      }
    } else {
      switch (text) {
        case '/start':
          await this.handleStart(msg);
          break;
        case '/schedule':
        case '📅 Расписание':
          await this.handleSchedule(msg);
          break;
        case '/other':
        case '📋 Другая группа':
          await this.handleOtherSchedule(msg);
          break;
        case '/stats':
        case '👤 Статистика':
          await this.handleStats(msg);
          break;
        case '/notifications':
        case '🔔 Уведомления':
          await this.handleNotifications(msg);
          break;
        case '/help':
          await this.handleHelp(msg);
          break;
        case '📆 Выбрать дату':
          await this.sendDateSelection(chatId);
          break;
        case '👥 Сменить группу':
          await this.sendGroupSelection(chatId, userId, isGroupChat);
          break;
        default:
          if (this.isGroupInput(text)) {
            const state = await this.messageManager.getState(chatId);
            if (state === 'awaiting_other_group') {
              await this.handleOtherGroupSchedule(msg, text);
            } else {
              await this.handleGroupInput(msg, text);
            }
          }
          else if (currentState === 'awaiting_time') {
            await this.handleTimeMessage(chatId, text);
            await this.messageManager.setState(chatId, null);
          }
      }
    }
  }

  private async handleStats(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    try {
      const [userPref, totalUsers, activeNotifications, groupPreferences] = await Promise.all([
        UserPreferenceModel.findOne({
          $or: [
            { userId, chatId },
            { groupChatId: chatId }
          ]
        }),
        UserPreferenceModel.countDocuments({ isGroupChat: false }),
        UserPreferenceModel.countDocuments({ notifications: true }),
        UserPreferenceModel.find({ isGroupChat: true })
      ]);


      const groupName = userPref?.groupId
        ? Object.entries(groupMap).find(([_, value]) => value === userPref.groupId)?.[0] || 'Неизвестная группа'
        : 'Не выбрана';

      const activeGroupsPromises = groupPreferences.map(async group => {
        try {
          const chatInfo = await this.bot.getChat(group.chatId);
          if (chatInfo.type === 'group' || chatInfo.type === 'supergroup') {
            return group;
          }
        } catch (error) {
          await UserPreferenceModel.deleteOne({ chatId: group.chatId })
            .catch(err => console.error(`Error deleting inactive group ${group.chatId}:`, err));
          console.log(`Removed inactive group ${group.chatId}`);
        }
        return null;
      });

      const activeGroups = (await Promise.all(activeGroupsPromises)).filter(Boolean);
      const statsMessage = this.buildStatsMessage({
        groupName,
        userPref,
        totalUsers,
        activeGroups: activeGroups.length,
        activeNotifications
      });

      await this.sendBotMessage(chatId, statsMessage, {
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
    } catch (error) {
      console.error('Error in handleStats:', error);
      await this.sendBotMessage(
        chatId,
        'Произошла ошибка при получении статистики. Попробуйте позже.'
      );
    }
  }

  private buildStatsMessage({
    groupName,
    userPref,
    totalUsers,
    activeGroups,
    activeNotifications
  }: {
    groupName: string;
    userPref?: any;
    totalUsers: number;
    activeGroups: number;
    activeNotifications: number;
  }): string {
    const sections = [
      {
        title: '👥 <b>Текущая группа:</b>',
        content: [
          `• Группа: ${groupName}`,
          userPref && `• Уведомления: ${userPref.notifications ? '✅ Включены' : '❌ Выключены'}`,
          userPref && `• Время уведомлений: ${userPref.notificationTime || 'Не установлено'}`
        ].filter(Boolean)
      },
      {
        title: '\n📈 <b>Общая информация:</b>',
        content: [
          `• Личных чатов: ${totalUsers.toLocaleString()}`,
          `• Активных групповых чатов: ${activeGroups.toLocaleString()}`
        ]
      },
      {
        title: '\n🔔 <b>Уведомления:</b>',
        content: [`• Активных подписок: ${activeNotifications.toLocaleString()}`]
      },
      {
        title: '\n📱 <b>Информация о боте:</b>',
        content: [
          `• Версия: ${VERSION}`,
          '• GitHub: <a href="https://github.com/iNeydlis/Schedule-bot-telegram">Schedule Bot</a>'
        ]
      },
      {
        title: '\n💡 <b>Возможности:</b>',
        content: [
          '• Просмотр расписания',
          '• Уведомления об изменениях',
          '• Поддержка групповых чатов',
          '• Навигация по датам'
        ]
      }
    ];

    return ['\n📊 <b>Статистика бота</b>\n']
      .concat(sections.map(section =>
        `\n${section.title}\n${section.content.join('\n')}`
      ))
      .join('');
  }

  private async handleOtherGroupSchedule(msg: TelegramBot.Message, groupName: string): Promise<void> {
    const chatId = msg.chat.id;
    const groupNameNormalized = groupName.toUpperCase();

    if (groupMap[groupNameNormalized]) {
      const groupId = groupMap[groupNameNormalized];
      await this.messageManager.setState(chatId, null);

      try {
        // Получаем текущую дату только если нет сохраненной даты или флага выбранной даты
        let currentDate = this.userSelectedDates.has(chatId)
          ? (this.dateMap.get(chatId) || new Date())
          : new Date();

        let schedule = await this.scheduleParser.fetchSchedule(groupId, currentDate);

        // Ищем следующий доступный день только если нет флага выбранной даты
        if (!this.userSelectedDates.has(chatId) && (!schedule.lessons || schedule.lessons.length === 0)) {
          currentDate = await this.findNextAvailableDay(currentDate, groupId);
          this.dateMap.set(chatId, currentDate);
          schedule = await this.scheduleParser.fetchSchedule(groupId, currentDate);
        }

        const formattedSchedule = this.formatFullSchedule(schedule, `Группа ${groupName}`);

        // Создаем отдельные объекты для inline и regular клавиатур
        const inlineKeyboard: TelegramBot.InlineKeyboardMarkup = {
          inline_keyboard: [
            [
              { text: "⬅️ Предыдущий день", callback_data: "prev_day" },
              { text: "Следующий день ➡️", callback_data: "next_day" }
            ]
          ]
        };


        // Отправляем сообщение с обеими клавиатурами
        const message = await this.bot.sendMessage(chatId, formattedSchedule, {
          parse_mode: 'HTML',
          reply_markup: {
            ...inlineKeyboard,
            ...this.mainKeyboard
          }
        });

        if (message) {
          await this.messageManager.addBotMessage(this.bot, chatId, message.message_id);
        }
      } catch (error) {
        console.error('Error fetching other group schedule:', error);
        await this.sendBotMessage(
          chatId,
          'Произошла ошибка при получении расписания. Попробуйте позже.'
        );
      }
    } else {
      await this.sendBotMessage(
        chatId,
        `Группа "${groupName}" не найдена. Попробуйте снова.`
      );
    }
  }

  private async handleHelp(msg: TelegramBot.Message): Promise<void> {
    const helpText = `
🤖 <b>Помощь по использованию бота</b>

📝 <b>Основные команды:</b>
• /start - Начать работу с ботом и выбрать группу
• /schedule - Показать расписание
• /other - Посмотреть расписание другой группы
• /notifications - Управление уведомлениями
• /stats - Показать статистику бота
• /help - Показать это сообщение

📱 <b>Основные кнопки меню:</b>
• 📅 Расписание - Посмотреть расписание
• 📆 Выбрать дату - Выбрать конкретную дату
• 👥 Сменить группу - Изменить текущую группу
• 🔔 Уведомления - Включить/выключить уведомления
• 👤 Статистика - Показать информацию о статистике бота

🔔 <b>Система уведомлений:</b>
• Уведомления приходят автоматически после обновления расписания на следующий день
• При повторном изменении расписания вы получите дополнительное уведомление, если будут отличия в парах
• Возможность отложить уведомления до определенного времени(по умолчанию все уведомления приходят после 15:00)

💡 <b>Как пользоваться в групповом чате:</b>
• Добавьте бота в группу как администратора
• Используйте команды, добавляя @${this.botUsername || 'имя_бота'}
• Например: /schedule@${this.botUsername || 'имя_бота'}
• При вводе номера группы используйте формат: 1234-1@${this.botUsername || 'имя_бота'}

⚙️ <b>Дополнительные возможности:</b>
• Выбор конкретной даты из календаря
• Автоматические уведомления об изменениях в расписании

❗️ <b>Права доступа в группах:</b>
• Изменять группу могут только администраторы
• Управлять уведомлениями могут только администраторы
• Просматривать расписание могут все участники

📌 <b>Формат номера группы:</b>
• Используйте формат XXXX-X (например: 1521-2)

🔗 <b>Исходный код:</b>
• GitHub: https://github.com/iNeydlis/Schedule-bot-telegram

`;

    await this.sendBotMessage(msg.chat.id, helpText, {
      parse_mode: 'HTML',
      disable_web_page_preview: true
    });
  }

  private async handleStart(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const isGroupChat = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

    if (!userId) return;

    const welcomeMessage = isGroupChat
      ? "Привет! Я бот для отслеживания расписания. Для начала работы администратор группы должен выбрать группу."
      : "Привет! Я бот для отслеживания расписания. Давай начнем с выбора твоей группы.";

    await this.sendBotMessage(chatId, welcomeMessage);

    if (!isGroupChat || await this.isUserAdmin(chatId, userId)) {
      await this.sendGroupSelection(chatId, userId, isGroupChat);
    }
  }

  private async isUserAdmin(chatId: number, userId: number): Promise<boolean> {
    try {
      const chatMember = await this.bot.getChatMember(chatId, userId);
      return ['creator', 'administrator'].includes(chatMember.status);
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  private async handleOtherSchedule(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;

    await this.sendBotMessage(
      chatId,
      "Введите номер группы, расписание которой хотите посмотреть (например, 1521-2):"
    );

    await this.messageManager.setState(chatId, 'awaiting_other_group');
  }

  private async handleSchedule(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;

    if (!userId) return;

    const userPref = await UserPreferenceModel.findOne({
      $or: [
        { userId, chatId },
        { groupChatId: chatId }
      ]
    });

    if (userPref) {
      // Всегда используем текущую дату при нажатии кнопки "Расписание"
      const currentDate = new Date();
      // Сбрасываем сохраненную дату и флаг выбранной даты
      this.dateMap.set(chatId, currentDate);
      this.userSelectedDates.delete(chatId);
      await this.sendSchedule(chatId, userPref.groupId);
    } else {
      await this.sendGroupSelection(chatId, userId, msg.chat.type !== 'private');
    }
  }

  private async sendSchedule(chatId: number, groupId: string): Promise<void> {
    try {
      // Получаем текущую дату только если нет сохраненной даты или флага выбранной даты
      let currentDate = this.userSelectedDates.has(chatId)
        ? (this.dateMap.get(chatId) || new Date())
        : new Date();

      let schedule = await this.scheduleParser.fetchSchedule(groupId, currentDate);

      // Ищем следующий доступный день только если нет флага выбранной даты
      if (!this.userSelectedDates.has(chatId) && (!schedule.lessons || schedule.lessons.length === 0)) {
        currentDate = await this.findNextAvailableDay(currentDate, groupId);
        this.dateMap.set(chatId, currentDate);
        schedule = await this.scheduleParser.fetchSchedule(groupId, currentDate);
      }
      const formattedSchedule = this.formatFullSchedule(schedule);

      // Создаем отдельные объекты для inline и regular клавиатур
      const inlineKeyboard: TelegramBot.InlineKeyboardMarkup = {
        inline_keyboard: [
          [
            { text: "⬅️ Предыдущий день", callback_data: "prev_day" },
            { text: "Следующий день ➡️", callback_data: "next_day" }
          ]
        ]
      };



      // Отправляем сообщение с обеими клавиатурами
      const message = await this.bot.sendMessage(chatId, formattedSchedule, {
        parse_mode: 'HTML',
        reply_markup: {
          ...inlineKeyboard,
          ...this.mainKeyboard
        }
      });

      if (message) {
        await this.messageManager.addBotMessage(this.bot, chatId, message.message_id);
      }
    } catch (error) {
      console.error('Error sending schedule:', error);
      await this.sendBotMessage(
        chatId,
        'Произошла ошибка при получении расписания. Попробуйте позже.'
      );
    }
  }

  private async handleNotifications(msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const isGroupChat = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

    if (!userId) return;

    if (isGroupChat && !await this.isUserAdmin(chatId, userId)) {
      await this.sendBotMessage(chatId, 'Только администраторы могут управлять уведомлениями в группе.');
      return;
    }

    const userPref = await UserPreferenceModel.findOne({
      $or: [
        { userId, chatId },
        { groupChatId: chatId }
      ]
    });

    if (!userPref) {
      await this.sendBotMessage(
        chatId,
        'Сначала выберите группу с помощью команды /start'
      );
      return;
    }

    const notificationStatus = userPref.notifications ? '✅ Включены' : '❌ Выключены';
    const message = `🔔 <b>Настройки уведомлений</b>\n\n` +
      `Статус: ${notificationStatus}\n` +
      `Время отправки: после ${userPref.notificationTime}\n` +
      'Подробнее об уведомлениях: /help'
      ;

    const keyboard = {
      inline_keyboard: [
        [
          {
            text: userPref.notifications ? '🔕 Выключить' : '🔔 Включить',
            callback_data: 'toggle_notifications'
          }
        ],
        [
          { text: '⏰ Изменить время', callback_data: 'change_time' }
        ],
        [
          { text: '📅 Показать расписание', callback_data: 'show_schedule' }
        ]
      ]
    };

    await this.sendBotMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  }

  private isGroupInput(text: string): boolean {
    return /^\d{4}-(\d{1}|[А-ЯA-Z]{2})$/.test(text.toUpperCase());
  }

  private async handleGroupInput(msg: TelegramBot.Message, groupName: string): Promise<void> {
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const isGroupChat = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

    if (!userId) return;

    if (isGroupChat && !await this.isUserAdmin(chatId, userId)) {
      await this.sendBotMessage(chatId, 'Только администраторы могут менять группу.');
      return;
    }

    const groupNameNormalized = groupName.toUpperCase();
    if (groupMap[groupNameNormalized]) {
      const groupId = groupMap[groupNameNormalized];
      await this.saveUserGroup(userId, chatId, groupId, isGroupChat);
      // Сбрасываем состояние после успешного сохранения группы
      await this.messageManager.setState(chatId, null);
      await this.sendBotMessage(chatId, `Группа ${groupName} успешно выбрана!`);
      await this.sendSchedule(chatId, groupId);
    } else {
      await this.sendBotMessage(chatId, `Группа "${groupName}" не найдена. Попробуйте снова.`);
      await this.sendGroupSelection(chatId, userId, isGroupChat);
    }
  }

  private async sendGroupSelection(chatId: number, userId: number, isGroupChat: boolean): Promise<void> {
    if (isGroupChat && !await this.isUserAdmin(chatId, userId)) {
      await this.sendBotMessage(chatId, 'Только администраторы могут выбирать группу.');
      return;
    }

    await this.sendBotMessage(
      chatId,
      isGroupChat
        ? "Введите номер группы для всего чата (например, 1521-2):"
        : "Введите вашу группу (например, 1521-2):"
    );
  }

  private async saveUserGroup(
    userId: number,
    chatId: number,
    groupId: string,
    isGroupChat: boolean
  ): Promise<void> {
    try {
      const query = isGroupChat ? { groupChatId: chatId } : { userId, chatId };
      const updateData = {
        userId,
        chatId,
        groupId,
        isGroupChat,
        ...(isGroupChat && { groupChatId: chatId }),
        updatedAt: new Date()
      };

      console.log('Saving user group:', { query, updateData });

      const result = await UserPreferenceModel.findOneAndUpdate(
        query,
        updateData,
        { upsert: true, new: true }
      );

      console.log('Save result:', result);
    } catch (error) {
      console.error('Error saving user group:', error);
      throw error;
    }
  }

  private async handleDayNavigation(chatId: number, userId: number, direction: string): Promise<void> {
    const userPref = await UserPreferenceModel.findOne({
      $or: [
        { userId, chatId },
        { groupChatId: chatId }
      ]
    });

    if (!userPref) return;

    try {
      // Используем chatId вместо userId для получения текущей даты
      const currentDate = this.dateMap.get(chatId) || new Date();

      const nextDate = new Date(currentDate);
      do {
        if (direction === 'next_day') {
          nextDate.setDate(nextDate.getDate() + 1);
        } else {
          nextDate.setDate(nextDate.getDate() - 1);
        }
      } while (nextDate.getDay() === 0 || nextDate.getDay() === 6);

      const schedule = await this.scheduleParser.fetchSchedule(userPref.groupId, nextDate);

      if (schedule.lessons && schedule.lessons.length > 0) {
        // Сохраняем дату используя chatId
        this.dateMap.set(chatId, nextDate);
        await this.sendSchedule(chatId, userPref.groupId);
      } else {
        const nextAvailableDate = await this.findNextAvailableDay(
          nextDate,
          userPref.groupId,
          direction === 'next_day' ? 'forward' : 'backward'
        );

        // Сохраняем дату используя chatId
        this.dateMap.set(chatId, nextAvailableDate);
        await this.sendSchedule(chatId, userPref.groupId);
      }

    } catch (error) {
      console.error('Error in handleDayNavigation:', error);
      await this.sendBotMessage(
        chatId,
        'Произошла ошибка при поиске расписания. Попробуйте позже.'
      );
    }
  }

  private async getNextTwoWeeks(): Promise<Date[]> {
    const dates: Date[] = [];
    const today = new Date();

    // Начинаем с текущего дня
    const startDate = new Date(today);
    const currentDayOfWeek = startDate.getDay();
    const daysUntilEndOfWeek = 7 - currentDayOfWeek;

    // Собираем все даты
    const allDates: Date[] = [];

    // Добавляем дни текущей недели
    for (let i = 0; i <= daysUntilEndOfWeek; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      allDates.push(date);
    }

    // Находим следующий понедельник
    const nextMonday = new Date(startDate);
    nextMonday.setDate(startDate.getDate() + (8 - currentDayOfWeek));

    // Добавляем дни следующей недели
    for (let i = 0; i < 7; i++) {
      const date = new Date(nextMonday);
      date.setDate(date.getDate() + i);
      allDates.push(date);
    }

    return allDates;
  }

  private async sendDateSelection(chatId: number): Promise<void> {
    try {
      // Получаем пользовательские настройки для определения группы
      const userPref = await UserPreferenceModel.findOne({
        $or: [
          { chatId },
          { groupChatId: chatId }
        ]
      });

      if (!userPref) {
        await this.sendBotMessage(chatId, "Сначала выберите группу с помощью команды /start");
        return;
      }

      const dates = await this.getNextTwoWeeks();
      const dateButtons: { date: Date; hasLessons: boolean }[] = [];

      // Проверяем наличие пар для каждой даты
      for (const date of dates) {
        try {
          const schedule = await this.scheduleParser.fetchSchedule(userPref.groupId, date);
          const hasLessons = schedule.lessons && schedule.lessons.length > 0;
          dateButtons.push({ date, hasLessons });
        } catch (error) {
          console.error(`Error fetching schedule for date ${date}:`, error);
          dateButtons.push({ date, hasLessons: false });
        }
      }

      const keyboard = {
        inline_keyboard: dateButtons.map(({ date, hasLessons }) => [{
          text: this.formatDateButton(date, hasLessons),
          callback_data: `date_${date.toISOString()}`
        }])
      };

      await this.sendBotMessage(
        chatId,
        "Выберите дату:\n📚 - есть пары\n⭕️ - нет пар",
        { reply_markup: keyboard }
      );
    } catch (error) {
      console.error('Error in sendDateSelection:', error);
      await this.sendBotMessage(
        chatId,
        'Произошла ошибка при загрузке дат. Попробуйте позже.'
      );
    }
  }

  private formatDateButton(date: Date, hasLessons: boolean): string {
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const dayOfWeek = days[date.getDay()];
    const dateText = date.toLocaleDateString('ru-RU');
    const icon = hasLessons ? '📚' : '⭕️';
    return `${dateText} (${dayOfWeek}) ${icon}`;
  }

  private async handleCallbackQuery(query: TelegramBot.CallbackQuery): Promise<void> {
    if (!query.message || !query.from.id) return;

    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    if (!data) return;

    try {
      switch (true) {
        case data === 'toggle_notifications':
          await this.toggleNotifications(chatId, userId);
          break;
        case data === 'change_time':
          await this.sendTimeSelectionMenu(chatId, userId);
          break;
        case data.startsWith('set_time_'):
          await this.setNotificationTime(chatId, data.split('_')[2]);
          break;
        case data === 'show_schedule':
          await this.handleSchedule({
            ...query.message,
            from: { id: userId }
          } as TelegramBot.Message);
          break;
        case data.startsWith('date_'):
          await this.handleDateSelection(chatId, userId, data.replace('date_', ''));
          break;
        case data === 'next_day':
        case data === 'prev_day':
          await this.handleDayNavigation(chatId, userId, data);
          break;
      }

      try {
        await this.bot.answerCallbackQuery(query.id);
      } catch (callbackError: any) {
        if (!callbackError.message?.includes('query is too old')) {
          console.error('Error answering callback query:', callbackError);
        }
      }
    } catch (error) {
      console.error('Error handling callback query:', error);
      await this.sendBotMessage(chatId, 'Произошла ошибка. Попробуйте позже.');


      try {
        await this.bot.answerCallbackQuery(query.id);
      } catch {

      }
    }
  }

  private async toggleNotifications(chatId: number, userId: number): Promise<void> {
    const userPref = await UserPreferenceModel.findOne({
      $or: [
        { userId, chatId },
        { groupChatId: chatId }
      ]
    });

    if (userPref) {
      userPref.notifications = !userPref.notifications;
      await userPref.save();
      await this.handleNotifications({ chat: { id: chatId }, from: { id: userId } } as TelegramBot.Message);
    }
  }

  private async handleTimeMessage(chatId: number, messageText: string): Promise<void> {
    try {
      console.log('Handling time message:', messageText); // Add logging
      const parsedTime = TimeInputHandler.parseTimeInput(messageText);

      if (!parsedTime.isValid) {
        await this.sendBotMessage(
          chatId,
          `❌ ${parsedTime.errorMessage}\n\nПожалуйста, введите время в формате:\n- 14:30\n- 14.30\n- 14 30\n- 1430`
        );
        return;
      }

      const formattedTime = `${parsedTime.hour.toString().padStart(2, '0')}:${parsedTime.minute.toString().padStart(2, '0')}`;
      await this.setNotificationTime(chatId, formattedTime);

      await this.messageManager.setState(chatId, null);
    } catch (error) {
      console.error('Error in handleTimeMessage:', error);
      await this.sendBotMessage(
        chatId,
        'Произошла ошибка при установке времени. Попробуйте позже.'
      );
    }
  }

  private async sendTimeSelectionMenu(chatId: number, userId: number): Promise<void> {
    try {
      await this.messageManager.setState(chatId, 'awaiting_time');
      await this.sendBotMessage(
        chatId,
        '⏰ Введите желаемое время для получения уведомлений (например, 15:00):'
      );
    } catch (error) {
      console.error('Error in sendTimeSelectionMenu:', error);
      await this.sendBotMessage(
        chatId,
        'Произошла ошибка. Попробуйте позже.'
      );
    }
  }

  private async setNotificationTime(chatId: number, time: string): Promise<void> {
    const userPref = await UserPreferenceModel.findOne({
      $or: [
        { chatId },
        { groupChatId: chatId }
      ]
    });

    if (userPref) {
      userPref.notificationTime = time;
      await userPref.save();
      await this.sendBotMessage(
        chatId,
        `✅ Время уведомлений установлено на ${time}`
      );
    }
  }

  private async handleDateSelection(chatId: number, userId: number, dateStr: string): Promise<void> {
    const userPref = await UserPreferenceModel.findOne({
      $or: [
        { userId, chatId },
        { groupChatId: chatId }
      ]
    });

    if (!userPref) return;

    const selectedDate = new Date(dateStr);
    // Используем chatId для сохранения даты
    this.dateMap.set(chatId, selectedDate);
    this.userSelectedDates.add(chatId);
    await this.sendSchedule(chatId, userPref.groupId);
  }

  private async findNextAvailableDay(
    startDate: Date,
    groupId: string,
    direction: 'forward' | 'backward' = 'forward'
  ): Promise<Date> {
    try {
      let currentDate = new Date(startDate);
      const maxDays = 14;
      const batchSize = 3;
      let attempts = 0;

      while (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
        if (direction === 'forward') {
          currentDate.setDate(currentDate.getDate() + 1);
        } else {
          currentDate.setDate(currentDate.getDate() - 1);
        }
      }

      while (attempts < maxDays) {
        const datesToCheck: Date[] = [];
        let tempDate = new Date(currentDate);

        while (datesToCheck.length < batchSize && attempts < maxDays) {
          if (tempDate.getDay() !== 0 && tempDate.getDay() !== 6) {
            datesToCheck.push(new Date(tempDate));
            attempts++;
          }
          if (direction === 'forward') {
            tempDate.setDate(tempDate.getDate() + 1);
          } else {
            tempDate.setDate(tempDate.getDate() - 1);
          }
        }

        if (datesToCheck.length === 0) break;

        const schedulePromises = datesToCheck.map(date =>
          this.scheduleParser.fetchSchedule(groupId, date)
        );

        const schedules = await Promise.all(schedulePromises);

        for (let i = 0; i < schedules.length; i++) {
          if (schedules[i].lessons && schedules[i].lessons.length > 0) {
            return datesToCheck[i];
          }
        }

        currentDate = new Date(tempDate);
      }

      return startDate;

    } catch (error) {
      console.error('Error in findNextAvailableDay:', error);
      return startDate;
    }
  }

  private formatFullSchedule(schedule: Schedule, groupTitle?: string): string {
    const hasLessons = schedule.lessons && Array.isArray(schedule.lessons) && schedule.lessons.length > 0;

    let message = '';
    if (groupTitle) {
      message += `👥 <b>${groupTitle}</b>\n`;
    }
    message += `📅 <b>${schedule.date} (${schedule.dayOfWeek})</b>\n\n`;

    if (!hasLessons) {
      message += '📢 <i>На этот день занятия не найдены</i>\n';
      message += `\n<i>Обновлено: ${new Date().toLocaleTimeString()}</i>`;
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