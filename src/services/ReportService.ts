import fs from 'fs';
import path from 'path';
import { Report } from '../types';

export class ReportService {
    private readonly reportsPath: string;
    private reports: Report[];
  
    constructor() {
      this.reportsPath = path.join(process.cwd(), 'reports', 'reports.json');
      this.reports = this.loadReports();
      this.ensureReportDirectory();
    }
  
    private ensureReportDirectory(): void {
      const dir = path.dirname(this.reportsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (!fs.existsSync(this.reportsPath)) {
        fs.writeFileSync(this.reportsPath, JSON.stringify([], null, 2));
      }
    }
  
    private loadReports(): Report[] {
      try {
        if (fs.existsSync(this.reportsPath)) {
          const data = fs.readFileSync(this.reportsPath, 'utf-8');
          return JSON.parse(data);
        }
        return [];
      } catch (error) {
        console.error('Error loading reports:', error);
        return [];
      }
    }
  
    private saveReports(): void {
      try {
        fs.writeFileSync(this.reportsPath, JSON.stringify(this.reports, null, 2));
      } catch (error) {
        console.error('Error saving reports:', error);
      }
    }
  
    public addReport(report: Omit<Report, 'id' | 'timestamp'>): void {
      const newReport: Report = {
        ...report,
        id: this.generateReportId(),
        timestamp: new Date().toISOString()
      };
  
      this.reports.push(newReport);
      this.saveReports();
    }
  
    private generateReportId(): string {
      return `REP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  
    public getReports(): Report[] {
      return this.reports;
    }
  }