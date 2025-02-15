import NodeCache from 'node-cache';
import { Schedule } from '../types';

export class CacheService {
  private static instance: CacheService;
  public  cache: NodeCache;
  public  readonly SCHEDULE_PREFIX = 'schedule_';
  public  readonly SCHEDULE_HASH_PREFIX = 'schedule_hash_';

  private constructor() {
    this.cache = new NodeCache({
      stdTTL: 24 * 60 * 60, 
      checkperiod: 60 * 60 
    });
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }


  public getSchedule(groupId: string, date: string): Schedule | undefined {
    const key = this.getScheduleKey(groupId, date);
    return this.cache.get<Schedule>(key);
  }


  public setSchedule(groupId: string, date: string, schedule: Schedule): void {
    const key = this.getScheduleKey(groupId, date);
    this.cache.set(key, schedule);
  }


  public getScheduleHash(chatId: number, date: Date): string | undefined {
    const key = this.getScheduleHashKey(chatId, date);
    return this.cache.get<string>(key);
  }


  public setScheduleHash(chatId: number, date: Date, hash: string): void {
    const key = this.getScheduleHashKey(chatId, date);
    const midnight = new Date(date);
    midnight.setHours(24, 0, 0, 0);
    const ttlSeconds = Math.floor((midnight.getTime() - Date.now()) / 1000);
    this.cache.set(key, hash, ttlSeconds);
  }

  public clearAllScheduleCaches(): void {
    const keys = this.cache.keys();
    const scheduleKeys = keys.filter(key => 
        key.startsWith(this.SCHEDULE_PREFIX) && 
        !key.startsWith(this.SCHEDULE_HASH_PREFIX)
    );
    
    console.log('Starting cache clearing process');
    console.log('Found schedule keys:', scheduleKeys);
    
    let failedKeys: string[] = [];
    scheduleKeys.forEach(key => {
        const success = this.cache.del(key);
        if (!success) {
            failedKeys.push(key);
            console.log(`Failed to delete key: ${key}`);
        } else {
            console.log(`Successfully deleted key: ${key}`);
        }
    });
 
    const remainingKeys = this.cache.keys().filter(key =>
        key.startsWith(this.SCHEDULE_PREFIX) && 
        !key.startsWith(this.SCHEDULE_HASH_PREFIX)
    );
 
    if (remainingKeys.length > 0) {
        console.log('Attempting second deletion for remaining keys:', remainingKeys);
        remainingKeys.forEach(key => {
            const success = this.cache.del(key);
            console.log(`Second attempt to delete ${key}: ${success ? 'successful' : 'failed'}`);
        });
    }
 
    console.log('Cache clearing process completed');
    console.log('Failed keys:', failedKeys);
    console.log('Final remaining keys:', this.cache.keys().filter(key =>
        key.startsWith(this.SCHEDULE_PREFIX) && 
        !key.startsWith(this.SCHEDULE_HASH_PREFIX)
    ));
 }

  public clearAllScheduleHashes(): void {
    const keys = this.cache.keys();    
    const hashKeys = keys.filter(key => key.startsWith(this.SCHEDULE_HASH_PREFIX));
    console.log('Clearing hash cache keys:', hashKeys);
    this.cache.del(hashKeys);   
  }


  public clearUserCache(chatId: number): void {
    const keys = this.cache.keys();
    const userKeys = keys.filter(key => key.includes(`${chatId}`));
    this.cache.del(userKeys);
  }

  private getScheduleKey(groupId: string, date: string): string {
    return `${this.SCHEDULE_PREFIX}${groupId}_${date}`;
  }

  private getScheduleHashKey(chatId: number, date: Date): string {
    const dateStr = date.toISOString().split('T')[0];
    return `${this.SCHEDULE_HASH_PREFIX}${chatId}_${dateStr}`;
  }
}