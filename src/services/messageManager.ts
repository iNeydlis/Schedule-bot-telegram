import TelegramBot from 'node-telegram-bot-api';
import mongoose from 'mongoose';

// Создаем схему для хранения сообщений
const messageSchema = new mongoose.Schema({
  chatId: { type: Number, required: true },
  messageIds: { type: [Number], required: true },
}, { collection: 'messageHistory' });

const MessageHistory = mongoose.model('MessageHistory', messageSchema);

export class MessageManager {
  private spamProtection: Map<number, { lastMessageTime: number; messageCount: number }> = new Map();
  private readonly SPAM_WINDOW = 30000; // 30 сек
  private readonly SPAM_LIMIT = 10; // максимум сообщений в минуту

  constructor() {
    this.startCleanupInterval();
  }
 private states: Map<number, string> = new Map();

  async setState(chatId: number, state: string | null): Promise<void> {
    if (state === null) {
      this.states.delete(chatId);
    } else {
      this.states.set(chatId, state);
    }
  }

  async getState(chatId: number): Promise<string | null> {
    return this.states.get(chatId) || null;
  }
  private startCleanupInterval() {
    setInterval(() => this.cleanupOldData(), 3600000); // очистка каждый час
  }

  private cleanupOldData() {
    const now = Date.now();
    for (const [userId, data] of this.spamProtection.entries()) {
      if (now - data.lastMessageTime > this.SPAM_WINDOW) {
        this.spamProtection.delete(userId);
      }
    }
  }

  async addMessage(bot: TelegramBot, chatId: number, messageId: number) {
    let history = await MessageHistory.findOne({ chatId });

    if (!history) {
      history = new MessageHistory({
        chatId,
        messageIds: [messageId],
      });
    } else {
      history.messageIds.push(messageId);
    }

    await history.save();

    try {
      const me = await bot.getMe();
      const chatMember = await bot.getChatMember(chatId, me.id);
      
      if (chatMember && 'can_delete_messages' in chatMember && chatMember.can_delete_messages) {
        await this.deleteOldMessages(bot, chatId);
      }
    } catch (error) {
      console.error(`Failed to check bot permissions in chat ${chatId}:`, error);
    }
  }

  // Новый метод для обработки сообщений бота
  async addBotMessage(bot: TelegramBot, chatId: number, messageId: number) {
    let history = await MessageHistory.findOne({ chatId });

    if (!history) {
      history = new MessageHistory({
        chatId,
        messageIds: [messageId],
      });
    } else {
      // Удаляем старые сообщения бота
      const deletePromises = history.messageIds.map(async (oldMessageId) => {
        try {
          await bot.deleteMessage(chatId, oldMessageId);
        } catch (error) {
          console.error(`Failed to delete bot message ${oldMessageId} in chat ${chatId}:`, error);
        }
      });

      await Promise.all(deletePromises);

      // Сохраняем только новое сообщение
      history.messageIds = [messageId];
    }

    await history.save();
  }

  private async deleteOldMessages(bot: TelegramBot, chatId: number) {
    // Загружаем историю сообщений для данного чата
    const history = await MessageHistory.findOne({ chatId });

    if (!history || history.messageIds.length <= 1) return;

    try {
      const deletePromises = history.messageIds.slice(0, -1).map(async (messageId) => { 
        try {
          await bot.deleteMessage(chatId, messageId);
        } catch (error) {
          console.error(`Failed to delete message ${messageId} in chat ${chatId}:`, error);
        }
      });
      await Promise.all(deletePromises);

      // Сохраняем только последнее сообщение
      history.messageIds = [history.messageIds[history.messageIds.length - 1]];
      await history.save();
    } catch (error) {
      console.error(`Error deleting old messages for chat ${chatId}:`, error);
    }
  }

  checkSpam(userId: number): boolean {
    const now = Date.now();
    
    if (!this.spamProtection.has(userId)) {
      this.spamProtection.set(userId, { lastMessageTime: now, messageCount: 1 });
      return false;
    }

    const userSpam = this.spamProtection.get(userId)!;
    
    if (now - userSpam.lastMessageTime > this.SPAM_WINDOW) {
      this.spamProtection.set(userId, { lastMessageTime: now, messageCount: 1 });
      return false;
    }

    userSpam.messageCount++;
    userSpam.lastMessageTime = now;
    this.spamProtection.set(userId, userSpam);
    return userSpam.messageCount > this.SPAM_LIMIT;
  }

  resetSpamCount(userId: number): void {
    this.spamProtection.delete(userId);
  }
}
