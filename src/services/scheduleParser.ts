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
  private readonly htmlCache = new Map<string, string>();

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

    let html = this.htmlCache.get(groupId);
    
    if (!html) {
      const url = `${this.baseUrl}/cg${groupId}.htm`;
      try {
        const response = await this.retry(() => this.axiosInstance.get(url));
        
        if (!response.data) {
          throw new Error('Empty response received');
        }

        html = iconv.decode(Buffer.from(response.data), 'win1251');
        this.htmlCache.set(groupId, html);
        
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const statusCode = error.response?.status;
          const errorMessage = error.response?.statusText || error.message;
          throw new Error(`Failed to fetch schedule: ${statusCode} ${errorMessage}`);
        }
        throw error;
      }
    }

    const schedule = await this.parseSchedule(html, date);
    this.cacheService.setSchedule(groupId, dateStr, schedule);
    return schedule;
  }

  private async parseSchedule(html: string, targetDate: Date): Promise<Schedule> {
    const $ = load(html, { 
      normalizeWhitespace: true,
      decodeEntities: false
    });
    
    const targetDateStr = this.formatDate(targetDate);
    const lessons: Lesson[] = [];

    const dateSelector = `td[align="center"]:contains("${targetDateStr}")`;
    const dateCell = $(dateSelector).first();
    
    if (!dateCell.length) {
      return {
        date: this.formatDate(targetDate),
        dayOfWeek: this.formatDayOfWeek(targetDate),
        lessons: []
      };
    }

    const dateRow = dateCell.parent('tr');
    if (!dateRow.length) return {
      date: this.formatDate(targetDate),
      dayOfWeek: this.formatDayOfWeek(targetDate),
      lessons: []
    };

    const lessonRows: cheerio.Cheerio[] = [];
    lessonRows.push(dateRow);
    
    let currentRow = dateRow;
    for (let i = 0; i < 5; i++) {
      const nextRow = currentRow.next('tr');
      if (!nextRow.length) break;
      lessonRows.push(nextRow);
      currentRow = nextRow;
    }

    lessonRows.forEach((row, index) => {
      this.parseLessonFromRow($, row, index + 1, lessons);
    });

    return {
      date: this.formatDate(targetDate),
      dayOfWeek: this.formatDayOfWeek(targetDate),
      lessons: lessons.filter(Boolean)
    };
  }

  private parseLessonFromRow($: cheerio.Root, $row: cheerio.Cheerio, number: number, lessons: Lesson[]): void {
    const timeCell = $row.find('td.hd:contains("Пара:")');
    const lessonCell = $row.find('td.ur');
    
    if (!timeCell.length || !lessonCell.length) return;

    const timeText = timeCell.text().trim();
    const timeMatch = timeText.match(TIME_REGEX);
    if (!timeMatch) return;

    const subject = lessonCell.find('.z1').first().text().trim();
    if (!subject) return;

    const shortTeacherName = lessonCell.find('.z3').first().text().trim();
    const room = lessonCell.find('.z2').first().text().trim();
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

  public clearHtmlCache(groupId?: string): void {
    if (groupId) {
      this.htmlCache.delete(groupId);
    } else {
      this.htmlCache.clear();
    }
  }
}