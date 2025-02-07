import TelegramBot from 'node-telegram-bot-api';
import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chatId: { type: Number, required: true },
  messageIds: { type: [Number], required: true },
}, { collection: 'messageHistory' });

const MessageHistory = mongoose.model('MessageHistory', messageSchema);

export class MessageManager {
  private lastCommandTime: Map<number, number> = new Map();
  
  private readonly MIN_COMMAND_INTERVAL = 150;

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

  shouldProcessCommand(userId: number): boolean {
    const now = Date.now();
    const lastTime = this.lastCommandTime.get(userId) || 0;
    
    if (now - lastTime < this.MIN_COMMAND_INTERVAL) {
      return false;
    }

    this.lastCommandTime.set(userId, now);
    return true;
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

  async addBotMessage(bot: TelegramBot, chatId: number, messageId: number) {
    let history = await MessageHistory.findOne({ chatId });

    if (!history) {
      history = new MessageHistory({
        chatId,
        messageIds: [messageId],
      });
    } else {
      const deletePromises = history.messageIds.map(async (oldMessageId) => {
        try {
          await bot.deleteMessage(chatId, oldMessageId);
        } catch (error) {
          console.error(`Failed to delete bot message ${oldMessageId} in chat ${chatId}:`, error);
        }
      });

      await Promise.all(deletePromises);
      history.messageIds = [messageId];
    }

    await history.save();
  }

  private async deleteOldMessages(bot: TelegramBot, chatId: number) {
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

      history.messageIds = [history.messageIds[history.messageIds.length - 1]];
      await history.save();
    } catch (error) {
      console.error(`Error deleting old messages for chat ${chatId}:`, error);
    }
  }
}