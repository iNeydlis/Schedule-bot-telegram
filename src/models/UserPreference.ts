import mongoose, { Schema } from 'mongoose';
import { UserPreference } from '../types';

const userPreferenceSchema = new Schema<UserPreference>({
  userId: { type: Number, required: true },
  chatId: { type: Number, required: true },
  groupId: { type: String, required: true },
  notifications: { type: Boolean, default: false },
  isGroupChat: { type: Boolean, default: false },
  groupChatId: { type: Number }
});

// Составной уникальный индекс для userId и chatId
userPreferenceSchema.index({ userId: 1, chatId: 1 }, { unique: true });

export const UserPreferenceModel = mongoose.model<UserPreference>('UserPreference', userPreferenceSchema);