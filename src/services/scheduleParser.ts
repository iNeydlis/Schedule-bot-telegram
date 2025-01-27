import axios from 'axios';
import { load } from 'cheerio';
import type * as cheerio from 'cheerio';
import { Lesson, Schedule } from '../types';
import iconv from 'iconv-lite';
import TeachersService from '../services/TeachersService';
import { CacheService } from './cacheService';

const TIME_REGEX = /\d+\.\d+-\d+\.\d+/;

export class ScheduleParser {
  private readonly baseUrl = 'https://dmitrov.politeh-mo.ru/rasp';
  private readonly timeout = 10000;
  private readonly maxRetries = 3;
  private readonly retryDelay = 5000;
  private readonly dateFormatter: Intl.DateTimeFormat;
  private readonly dayFormatter: Intl.DateTimeFormat;
  private readonly axiosInstance;
  
  private readonly teachersService: TeachersService;
  private readonly cacheService: CacheService;

  constructor() {
    this.teachersService = TeachersService.getInstance();
    this.cacheService = CacheService.getInstance();
    
    this.dateFormatter = new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    this.dayFormatter = new Intl.DateTimeFormat('ru-RU', { weekday: 'long' });

    this.axiosInstance = axios.create({
      timeout: this.timeout,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      validateStatus: (status) => status === 200
    });
  }

  private async retry<T>(operation: () => Promise<T>, retries = this.maxRetries): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.retry(operation, retries - 1);
      }
      throw error;
    }
  }

  async fetchSchedule(groupId: string, date = new Date()): Promise<Schedule> {
    const dateStr = this.formatDate(date);
    const cacheKey = `${groupId}_${dateStr}`;
    
    const cachedSchedule = this.cacheService.getSchedule(groupId, dateStr);
    if (cachedSchedule) return cachedSchedule;

    const url = `${this.baseUrl}/cg${groupId}.htm`;

    try {
      const response = await this.retry(() => this.axiosInstance.get(url));
      
      if (!response.data) {
        throw new Error('Empty response received');
      }

      const html = iconv.decode(Buffer.from(response.data), 'win1251');
      const schedule = await this.parseSchedule(html, date);
      
      this.cacheService.setSchedule(groupId, dateStr, schedule);
      return schedule;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.statusText || error.message;
        throw new Error(`Failed to fetch schedule: ${statusCode} ${errorMessage}`);
      }
      throw error;
    }
  }

  private async parseSchedule(html: string, targetDate: Date): Promise<Schedule> {
    const $ = load(html, { 
      normalizeWhitespace: true,
      decodeEntities: false
    });
    
    const targetDateStr = this.formatDate(targetDate);
    const lessons: Lesson[] = [];

    const dateRows = $('tr').filter((_, row) => {
      const dateCell = $(row).find('td[align="center"]').first();
      return dateCell.text().trim().includes(targetDateStr);
    });

    if (dateRows.length === 0) {
      return {
        date: this.formatDate(targetDate),
        dayOfWeek: this.formatDayOfWeek(targetDate),
        lessons: []
      };
    }

    const dateRow = dateRows.first();
    
    this.parseLessonFromRow($, dateRow, 1, lessons);

    let currentRow = dateRow.next('tr');
    for (let i = 1; currentRow.length && i < 6; i++) {
      this.parseLessonFromRow($, currentRow, i + 1, lessons);
      currentRow = currentRow.next('tr');
    }

    return {
      date: this.formatDate(targetDate),
      dayOfWeek: this.formatDayOfWeek(targetDate),
      lessons: lessons
    };
  }

  private parseLessonFromRow($: cheerio.Root, $row: cheerio.Cheerio, number: number, lessons: Lesson[]): void {
    const timeCell = $row.find('td.hd').filter((_, el) => {
      return $(el).text().includes('Пара:');
    });
    
    const lessonCell = $row.find('td.ur');
    
    if (!timeCell.length || !lessonCell.length) return;

    const timeText = timeCell.text().trim();
    const timeMatch = timeText.match(TIME_REGEX);
    if (!timeMatch) return;

    const subject = lessonCell.find('.z1').text().trim();
    if (!subject) return;

    const shortTeacherName = lessonCell.find('.z3').text().trim();
    const room = lessonCell.find('.z2').text().trim();
    const teacher = this.teachersService.getFullName(shortTeacherName);

    lessons.push({
      number,
      time: timeMatch[0],
      subject,
      teacher,
      room
    });
  }

  private formatDate(date: Date): string {
    return this.dateFormatter.format(date);
  }

  private formatDayOfWeek(date: Date): string {
    return this.dayFormatter.format(date);
  }
}