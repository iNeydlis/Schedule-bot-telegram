import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { ScheduleBot } from './bot';

dotenv.config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const MONGODB_URI = process.env.MONGODB_URI;

if (!TELEGRAM_TOKEN || !MONGODB_URI) {
  throw new Error('Required environment variables are not set');
}

async function startBot() {
  try {
    // Using type assertion to tell TypeScript these are definitely strings
    await mongoose.connect(MONGODB_URI as string);
    console.log('Connected to MongoDB');
    
    const bot = new ScheduleBot(TELEGRAM_TOKEN as string);
    console.log('Bot started');
  } catch (error) {
    console.error('Error starting bot:', error);
    process.exit(1);
  }
}

startBot();