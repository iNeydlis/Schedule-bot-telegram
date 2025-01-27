export interface Schedule {
  date: string;
  dayOfWeek: string;
  lessons: Lesson[];
  isEmpty?: boolean;
}

export interface Lesson {
  number: number;
  time: string;
  subject: string;
  teacher: string;
  room: string;
}

export interface UserPreference {
  userId: number;
  chatId: number;
  groupId: string;
  notifications: boolean;
  notificationTime: String, 
  isGroupChat: boolean;
  groupChatId?: number;
}
export interface MessageManager {
  setState(chatId: number, state: string | null): Promise<void>;
  getState(chatId: number): Promise<string | null>;
 
}
export interface Teacher{
  fullName: string;
  shortName: string;
  disciplines: []
}