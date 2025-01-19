import axios from 'axios';
import { load } from 'cheerio';
import { Lesson, Schedule } from '../types';
import iconv from 'iconv-lite';
import TeachersService from '../services/TeachersService';

export class ScheduleParser {
  private baseUrl: string;
  private readonly timeout: number = 10000;
  private teachersService: TeachersService;

  constructor() {
    this.baseUrl = 'https://dmitrov.politeh-mo.ru/rasp';
    this.teachersService = TeachersService.getInstance();
  }

  async fetchSchedule(groupId: string, date: Date = new Date()): Promise<Schedule> {    

    const url = `${this.baseUrl}/cg${groupId}.htm`;
    console.log('Fetching schedule from:', url);

    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        validateStatus: (status) => status === 200
      });

      if (!response.data) {
        throw new Error('Empty response received');
      }

      const html = iconv.decode(Buffer.from(response.data), 'win1251');
      const schedule = await this.parseSchedule(html, date);
      
      if (schedule.lessons.length === 0) {
        return {
          date: date.toLocaleDateString('ru-RU'),
          dayOfWeek: date.toLocaleDateString('ru-RU', { weekday: 'long' }),
          lessons: [],
          isEmpty: true
        };
      }

      return schedule;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.statusText || error.message;
        
        console.error('Network error:', {
          url,
          statusCode,
          message: errorMessage,
          details: error.response?.data
        });

        throw new Error(`Failed to fetch schedule: ${statusCode} ${errorMessage}`);
      }

      console.error('Parser error:', error);
      throw new Error('Failed to parse schedule data');
    }
  }

  private async parseSchedule(html: string, targetDate: Date): Promise<Schedule> {
    const $ = load(html);
    const lessons: Lesson[] = [];
    const targetDateStr = this.formatDate(targetDate);
    
    console.log('Looking for date:', targetDateStr);

    try {
      let dateFound = false;
      
      $('tr').each((_, dateRow) => {
        const dateCell = $(dateRow).find('td[align="center"]').first();
        const rowDate = dateCell.text().trim();
        
        if (rowDate.includes(targetDateStr)) {
          dateFound = true;
          console.log('Found matching date row:', rowDate);
          
          // Теперь обрабатываем саму строку с датой, так как она содержит первую пару
          const lessonCell = $(dateRow).find('td.ur');
          const timeCell = $(dateRow).find('td.hd').filter((_, el) => {
            return $(el).text().includes('Пара:');
          });
          
          // Проверяем наличие первой пары в текущей строке
          if (lessonCell.length && timeCell.length) {
            const timeText = timeCell.text().trim();
            const timeMatch = timeText.match(/\d+\.\d+-\d+\.\d+/);
            const time = timeMatch ? timeMatch[0] : '';
            
            const subject = lessonCell.find('.z1').text().trim();
            const shortTeacherName  = lessonCell.find('.z3').text().trim();
            const room = lessonCell.find('.z2').text().trim();
            
            if (subject) {
              const teacher = this.teachersService.getFullName(shortTeacherName);
              lessons.push({
                number: 1,
                time,
                subject,
                teacher,
                room
              });
              console.log('Found first lesson:', {
                time,
                subject,
                teacher,
                room
              });
            }
          }
          
          // Теперь обрабатываем следующие пары
          let currentRow = $(dateRow).next('tr');
          for (let i = 1; i < 6; i++) {
            if (!currentRow.length) break;
            
            const timeCell = currentRow.find('td.hd').first();
            const lessonCell = currentRow.find('td.ur');
            
            if (timeCell.length && lessonCell.length) {
              const timeText = timeCell.text().trim();
              const timeMatch = timeText.match(/\d+\.\d+-\d+\.\d+/);
              const time = timeMatch ? timeMatch[0] : '';
              
              const subject = lessonCell.find('.z1').text().trim();
              const shortTeacherName = lessonCell.find('.z3').text().trim();
              const room = lessonCell.find('.z2').text().trim();
              
              if (subject) {
                const teacher = this.teachersService.getFullName(shortTeacherName);
                lessons.push({
                  number: i + 1,
                  time,
                  subject,
                  teacher,
                  room
                });
                console.log(`Found lesson ${i + 1}:`, {
                  time,
                  subject,
                  teacher,
                  room
                });
              }
            }
            
            currentRow = currentRow.next('tr');
          }
          
          return false;
        }
      });

      if (!dateFound) {
        console.log('No matching date found in the schedule');
      }

      return {
        date: targetDate.toLocaleDateString('ru-RU'),
        dayOfWeek: targetDate.toLocaleDateString('ru-RU', { weekday: 'long' }),
        lessons: lessons.sort((a, b) => a.number - b.number)
      };

    } catch (error) {
      console.error('HTML parsing error:', error);
      throw new Error('Failed to parse HTML content');
    }
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
}