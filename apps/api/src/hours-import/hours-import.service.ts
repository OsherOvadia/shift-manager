import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';
import * as bcrypt from 'bcrypt';

interface ParsedShift {
  day: string;           // Hebrew day letter (א, ב, ג, etc.)
  totalHours: number;
  startTime: string | null;  // "HH:MM"
  endTime: string | null;    // "HH:MM"
}

interface ParsedWorker {
  name: string;           // Worker name from Excel
  shifts: ParsedShift[];
  totalHours: number;
  hours100: number;
  hours125: number;
  hours150: number;
  workDays: number;
}

interface MatchedWorker extends ParsedWorker {
  matchedUserId: string | null;
  matchedUserName: string | null;
  matchStatus: 'matched' | 'partial' | 'unmatched';
  matchCandidates: { id: string; name: string }[];
}

export interface ImportPreview {
  sessionId: string;
  fileName: string;
  workers: MatchedWorker[];
  summary: {
    totalWorkers: number;
    matched: number;
    unmatched: number;
    totalHours: number;
    totalShifts: number;
  };
}

// In-memory store for import sessions (simple approach, no Redis needed)
const importSessions = new Map<string, { preview: ImportPreview; parsedData: ParsedWorker[]; timestamp: number }>();

// Clean up old sessions (older than 30 minutes)
function cleanOldSessions() {
  const now = Date.now();
  for (const [key, value] of importSessions.entries()) {
    if (now - value.timestamp > 30 * 60 * 1000) {
      importSessions.delete(key);
    }
  }
}

@Injectable()
export class HoursImportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse an Excel file and return a preview of the data
   */
  async parseAndPreview(
    buffer: Buffer,
    fileName: string,
    organizationId: string,
    workerOverrides?: { [excelName: string]: string },
  ): Promise<ImportPreview> {
    cleanOldSessions();

    // 1. Parse the Excel file
    const parsedWorkers = this.parseExcelFile(buffer);

    if (parsedWorkers.length === 0) {
      throw new BadRequestException('לא נמצאו נתוני עובדים בקובץ');
    }

    // 2. Match workers to users in DB
    const matchedWorkers = await this.matchWorkers(parsedWorkers, organizationId, workerOverrides);

    // 3. Generate session ID and store
    const sessionId = this.generateSessionId();
    const preview: ImportPreview = {
      sessionId,
      fileName,
      workers: matchedWorkers,
      summary: {
        totalWorkers: matchedWorkers.length,
        matched: matchedWorkers.filter(w => w.matchStatus === 'matched').length,
        unmatched: matchedWorkers.filter(w => w.matchStatus === 'unmatched').length,
        totalHours: matchedWorkers.reduce((sum, w) => sum + w.totalHours, 0),
        totalShifts: matchedWorkers.reduce((sum, w) => sum + w.shifts.length, 0),
      },
    };

    importSessions.set(sessionId, {
      preview,
      parsedData: parsedWorkers,
      timestamp: Date.now(),
    });

    return preview;
  }

  /**
   * Apply the import - update worker hours in the database
   * For unmatched workers: auto-create user profiles and notify managers
   */
  async applyImport(
    sessionId: string,
    organizationId: string,
    workerMapping: { [excelName: string]: string },
  ) {
    const session = importSessions.get(sessionId);
    if (!session) {
      throw new BadRequestException('Import session expired or not found. Please upload the file again.');
    }

    // Re-match with the user-supplied mapping
    const matchedWorkers = await this.matchWorkers(
      session.parsedData,
      organizationId,
      workerMapping,
    );

    const results: { name: string; userId: string; totalHours: number; status: string; isNew: boolean }[] = [];
    const newlyCreatedUsers: { id: string; name: string }[] = [];

    for (const worker of matchedWorkers) {
      if (worker.matchedUserId) {
        // Existing matched worker
        const user = await this.prisma.user.findFirst({
          where: { id: worker.matchedUserId, organizationId },
        });

        if (!user) continue;

        results.push({
          name: worker.name,
          userId: worker.matchedUserId,
          totalHours: worker.totalHours,
          status: 'updated',
          isNew: false,
        });
      } else {
        // Unmatched worker - auto-create a new user profile
        const newUser = await this.createWorkerProfile(worker.name, organizationId);
        newlyCreatedUsers.push({ id: newUser.id, name: worker.name });

        results.push({
          name: worker.name,
          userId: newUser.id,
          totalHours: worker.totalHours,
          status: 'created',
          isNew: true,
        });
      }
    }

    // Send notifications to managers/admins about newly created users
    if (newlyCreatedUsers.length > 0) {
      await this.notifyManagersAboutNewWorkers(organizationId, newlyCreatedUsers);
    }

    // Clean up session
    importSessions.delete(sessionId);

    return {
      success: true,
      results,
      newlyCreated: newlyCreatedUsers,
      summary: {
        updated: results.filter(r => !r.isNew).length,
        created: newlyCreatedUsers.length,
        totalHours: results.reduce((sum, r) => sum + r.totalHours, 0),
      },
    };
  }

  /**
   * Create a new worker profile from an Excel name
   * Creates with minimal info - manager needs to complete the profile
   */
  private async createWorkerProfile(name: string, organizationId: string) {
    // Split name into first/last - for single names, use it as firstName
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || name;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '-';

    // Generate a placeholder email and password
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const placeholderEmail = `worker_${timestamp}_${randomSuffix}@placeholder.local`;
    const tempPassword = `Temp${timestamp}!`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const user = await this.prisma.user.create({
      data: {
        email: placeholderEmail,
        passwordHash,
        firstName,
        lastName,
        role: 'EMPLOYEE' as any,
        employmentType: 'FULL_TIME' as any,
        organizationId,
        isApproved: true,
        isActive: true,
        hourlyWage: 0,
      },
    });

    return user;
  }

  /**
   * Notify all managers and admins about newly created worker profiles
   * that need their details filled in (job type, salary, email, etc.)
   */
  private async notifyManagersAboutNewWorkers(
    organizationId: string,
    newWorkers: { id: string; name: string }[],
  ) {
    // Find all managers and admins in the organization
    const managers = await this.prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        isApproved: true,
        role: { in: ['ADMIN', 'MANAGER'] as any },
      },
      select: { id: true },
    });

    const workerNames = newWorkers.map(w => w.name).join(', ');
    const title = `👤 עובדים חדשים נוצרו מקובץ שעות`;
    const message = newWorkers.length === 1
      ? `העובד/ת "${newWorkers[0].name}" נוצר/ה אוטומטית מהעלאת קובץ שעות. נא להשלים את הפרטים: תפקיד, שכר, אימייל ועוד.`
      : `${newWorkers.length} עובדים חדשים נוצרו אוטומטית מהעלאת קובץ שעות: ${workerNames}. נא להשלים את הפרטים שלהם: תפקיד, שכר, אימייל ועוד.`;

    // Create notification for each manager/admin
    for (const manager of managers) {
      await this.prisma.notification.create({
        data: {
          userId: manager.id,
          title,
          message,
          type: 'SHIFT_CHANGED' as any, // Using existing type - closest match
        },
      });
    }
  }

  /**
   * Get list of all employees in the organization for manual matching
   */
  async getOrganizationEmployees(organizationId: string) {
    const users = await this.prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobCategory: {
          select: { name: true, nameHe: true },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return users.map(u => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      firstName: u.firstName,
      lastName: u.lastName,
      category: u.jobCategory?.nameHe || u.jobCategory?.name || '',
    }));
  }

  // ==================== PARSING LOGIC ====================

  private parseExcelFile(buffer: Buffer): ParsedWorker[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const workers: ParsedWorker[] = [];

    // Process each sheet - each sheet may represent a worker section
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];

      if (!data || data.length === 0) continue;

      // Parse workers from this sheet
      const sheetWorkers = this.parseSheetData(data);
      workers.push(...sheetWorkers);
    }

    return workers;
  }

  private parseSheetData(data: any[][]): ParsedWorker[] {
    const workers: ParsedWorker[] = [];
    let currentWorkerName: string | null = null;
    let currentShifts: ParsedShift[] = [];
    let totalHours = 0;
    let hours100 = 0;
    let hours125 = 0;
    let hours150 = 0;
    let workDays = 0;

    // Find worker sections by scanning for patterns
    // The Excel format has:
    // - Header row with: "עובד" column (worker name), day columns, times, hours
    // - Data rows with shifts
    // - Summary rows with totals

    for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx];
      if (!row || row.length === 0) continue;

      // Convert row to strings for easier matching
      const rowStr = row.map(cell => String(cell || '').trim());

      // Check if this is a "שם עובד:" (worker name) header row
      const workerNameIdx = rowStr.findIndex(cell =>
        cell.includes('עובד:') || cell.includes('שם עובד')
      );

      if (workerNameIdx !== -1) {
        // Save previous worker if exists
        if (currentWorkerName) {
          workers.push({
            name: currentWorkerName,
            shifts: currentShifts,
            totalHours,
            hours100,
            hours125,
            hours150,
            workDays,
          });
        }

        // Extract worker name - typically the cell after "עובד:"
        let name = '';
        // Check if the name is in the same cell
        const cell = rowStr[workerNameIdx];
        if (cell.includes(':')) {
          name = cell.split(':').pop()?.trim() || '';
        }
        // If not found, check adjacent cells
        if (!name) {
          for (let i = workerNameIdx + 1; i < rowStr.length; i++) {
            if (rowStr[i] && rowStr[i] !== '0' && !rowStr[i].includes(':')) {
              name = rowStr[i];
              break;
            }
          }
        }
        // Also check previous cell (RTL layout)
        if (!name && workerNameIdx > 0) {
          name = rowStr[workerNameIdx - 1] || '';
        }

        currentWorkerName = name || null;
        currentShifts = [];
        totalHours = 0;
        hours100 = 0;
        hours125 = 0;
        hours150 = 0;
        workDays = 0;
        continue;
      }

      // Check for worker data rows - they have a name, day letter, and hours
      // Pattern: [worker_name_column] [day_letter] [name] [... hours data]
      // Based on the Excel: columns contain עובד, שם, יום, הפסקה, שבת, 150%, 125%, 100%, סה"כ, יציאה, כניסה, תאריך
      if (currentWorkerName === null) {
        // Try to find worker name from data rows directly
        // The Excel shows rows like: "אחמשית | יובל | א | 0 | 0 | 5.36 | 0 | 5:22 | 0:22 | 19:00 | ###"
        // Worker name appears in "שם" column and category in "עובד" column

        // Look for rows that have time patterns (HH:MM) which indicate shift data
        const hasTimePattern = rowStr.some(cell => /^\d{1,2}:\d{2}$/.test(cell));
        if (!hasTimePattern) continue;

        // This is likely a data row without a prior worker header
        // Try to extract name from the row
        const hebrewDays = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
        let nameFound = '';
        let dayFound = '';

        for (const cell of rowStr) {
          if (hebrewDays.includes(cell) && !dayFound) {
            dayFound = cell;
          } else if (cell.length > 1 && /^[\u0590-\u05FF]+$/.test(cell) && !nameFound) {
            nameFound = cell;
          }
        }

        if (nameFound) {
          // Check if we already have this worker
          let existingWorker = workers.find(w => w.name === nameFound);
          if (!existingWorker) {
            existingWorker = {
              name: nameFound,
              shifts: [],
              totalHours: 0,
              hours100: 0,
              hours125: 0,
              hours150: 0,
              workDays: 0,
            };
            workers.push(existingWorker);
          }

          // Extract shift data from this row
          const shift = this.extractShiftFromRow(rowStr, dayFound);
          if (shift) {
            existingWorker.shifts.push(shift);
            existingWorker.totalHours += shift.totalHours;
            existingWorker.workDays = existingWorker.shifts.length;
          }
        }
        continue;
      }

      // Check for summary rows (סה"כ ימי עבודה, סה"כ שעות, etc.)
      const isSummaryRow = rowStr.some(cell =>
        cell.includes('סה"כ') || cell.includes('סהכ') || cell.includes('לתשלום')
      );

      if (isSummaryRow) {
        // Extract totals from summary
        const hoursMatch = rowStr.find(cell => {
          const num = parseFloat(cell);
          return !isNaN(num) && num > 0;
        });
        if (hoursMatch) {
          const summaryLabel = rowStr.find(cell =>
            cell.includes('שעות') || cell.includes('לתשלום')
          );
          if (summaryLabel) {
            totalHours = parseFloat(hoursMatch) || totalHours;
          }
        }

        // Check for overtime breakdown
        const pct100Idx = rowStr.findIndex(cell => cell.includes('100%'));
        if (pct100Idx !== -1) {
          for (const cell of rowStr) {
            const num = parseFloat(cell);
            if (!isNaN(num) && num > 0) {
              hours100 = num;
              break;
            }
          }
        }

        const pct125Idx = rowStr.findIndex(cell => cell.includes('125%'));
        if (pct125Idx !== -1) {
          for (const cell of rowStr) {
            const num = parseFloat(cell);
            if (!isNaN(num) && num > 0) {
              hours125 = num;
              break;
            }
          }
        }

        const pct150Idx = rowStr.findIndex(cell => cell.includes('150%'));
        if (pct150Idx !== -1) {
          for (const cell of rowStr) {
            const num = parseFloat(cell);
            if (!isNaN(num) && num > 0) {
              hours150 = num;
              break;
            }
          }
        }

        continue;
      }

      // Regular data row - extract shift data
      const hebrewDays = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
      let dayFound = '';
      for (const cell of rowStr) {
        if (hebrewDays.includes(cell)) {
          dayFound = cell;
          break;
        }
      }

      if (dayFound) {
        const shift = this.extractShiftFromRow(rowStr, dayFound);
        if (shift) {
          currentShifts.push(shift);
        }
      }
    }

    // Save last worker
    if (currentWorkerName) {
      // If no totalHours from summary, calculate from shifts
      if (totalHours === 0) {
        totalHours = currentShifts.reduce((sum, s) => sum + s.totalHours, 0);
      }
      workDays = currentShifts.length;

      workers.push({
        name: currentWorkerName,
        shifts: currentShifts,
        totalHours,
        hours100,
        hours125,
        hours150,
        workDays,
      });
    }

    // Post-process: for workers found by row scanning, update totals
    for (const worker of workers) {
      if (worker.totalHours === 0 && worker.shifts.length > 0) {
        worker.totalHours = worker.shifts.reduce((sum, s) => sum + s.totalHours, 0);
      }
      worker.workDays = worker.shifts.length;
    }

    return workers;
  }

  private extractShiftFromRow(row: string[], day: string): ParsedShift | null {
    // Find hours and time values from the row
    let totalHours = 0;
    let startTime: string | null = null;
    let endTime: string | null = null;

    const timeValues: string[] = [];
    const numberValues: number[] = [];

    for (const cell of row) {
      // Check for time pattern HH:MM or H:MM
      if (/^\d{1,2}:\d{2}$/.test(cell)) {
        const [h, m] = cell.split(':').map(Number);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          timeValues.push(cell);
        }
      }

      // Check for decimal hours (like 5.36, 6.26)
      const num = parseFloat(cell);
      if (!isNaN(num) && num > 0 && num < 24 && cell.includes('.')) {
        numberValues.push(num);
      }
    }

    // The row typically has: כניסה (entry/start), יציאה (exit/end), סה"כ (total hours)
    // In RTL: the first time is usually start time, second is end time
    if (timeValues.length >= 2) {
      startTime = timeValues[timeValues.length - 1]; // Last time value = entry (כניסה)
      endTime = timeValues[timeValues.length - 2];   // Second to last = exit (יציאה)
    } else if (timeValues.length === 1) {
      startTime = timeValues[0];
    }

    // Total hours - look for the largest decimal number
    if (numberValues.length > 0) {
      totalHours = Math.max(...numberValues);
    }

    // Also check for hour:minute format in "סה"כ" column (e.g., "5:22" meaning 5h 22min)
    for (const cell of row) {
      if (/^\d{1,2}:\d{2}$/.test(cell)) {
        const [h, m] = cell.split(':').map(Number);
        const hours = h + m / 60;
        if (hours > 3 && hours < 18) { // Reasonable shift length
          if (hours > totalHours) {
            totalHours = hours;
          }
        }
      }
    }

    if (totalHours === 0) return null;

    return {
      day,
      totalHours: Math.round(totalHours * 100) / 100,
      startTime,
      endTime,
    };
  }

  // ==================== WORKER MATCHING ====================

  private async matchWorkers(
    parsedWorkers: ParsedWorker[],
    organizationId: string,
    overrides?: { [excelName: string]: string },
  ): Promise<MatchedWorker[]> {
    // Get all active users in the organization
    const users = await this.prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    return parsedWorkers.map(worker => {
      // Check for manual override first
      if (overrides && overrides[worker.name]) {
        const user = users.find(u => u.id === overrides[worker.name]);
        if (user) {
          return {
            ...worker,
            matchedUserId: user.id,
            matchedUserName: `${user.firstName} ${user.lastName}`,
            matchStatus: 'matched' as const,
            matchCandidates: [],
          };
        }
      }

      // Try exact first name match (most common in Hebrew work environment)
      const exactFirstMatch = users.find(
        u => u.firstName.trim().toLowerCase() === worker.name.trim().toLowerCase()
      );
      if (exactFirstMatch) {
        return {
          ...worker,
          matchedUserId: exactFirstMatch.id,
          matchedUserName: `${exactFirstMatch.firstName} ${exactFirstMatch.lastName}`,
          matchStatus: 'matched' as const,
          matchCandidates: [],
        };
      }

      // Try full name match
      const fullNameMatch = users.find(u => {
        const fullName = `${u.firstName} ${u.lastName}`.trim().toLowerCase();
        return fullName === worker.name.trim().toLowerCase();
      });
      if (fullNameMatch) {
        return {
          ...worker,
          matchedUserId: fullNameMatch.id,
          matchedUserName: `${fullNameMatch.firstName} ${fullNameMatch.lastName}`,
          matchStatus: 'matched' as const,
          matchCandidates: [],
        };
      }

      // Try last name match
      const lastNameMatch = users.find(
        u => u.lastName.trim().toLowerCase() === worker.name.trim().toLowerCase()
      );
      if (lastNameMatch) {
        return {
          ...worker,
          matchedUserId: lastNameMatch.id,
          matchedUserName: `${lastNameMatch.firstName} ${lastNameMatch.lastName}`,
          matchStatus: 'matched' as const,
          matchCandidates: [],
        };
      }

      // Try partial/contains match
      const partialMatches = users.filter(u => {
        const firstName = u.firstName.trim().toLowerCase();
        const lastName = u.lastName.trim().toLowerCase();
        const workerName = worker.name.trim().toLowerCase();
        return firstName.includes(workerName) ||
               lastName.includes(workerName) ||
               workerName.includes(firstName) ||
               workerName.includes(lastName);
      });

      if (partialMatches.length === 1) {
        return {
          ...worker,
          matchedUserId: partialMatches[0].id,
          matchedUserName: `${partialMatches[0].firstName} ${partialMatches[0].lastName}`,
          matchStatus: 'partial' as const,
          matchCandidates: [],
        };
      }

      // Unmatched - provide candidates for manual selection
      const candidates = users.map(u => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
      }));

      return {
        ...worker,
        matchedUserId: partialMatches.length > 0 ? partialMatches[0].id : null,
        matchedUserName: partialMatches.length > 0 ? `${partialMatches[0].firstName} ${partialMatches[0].lastName}` : null,
        matchStatus: 'unmatched' as const,
        matchCandidates: candidates,
      };
    });
  }

  // ==================== HELPERS ====================

  private generateSessionId(): string {
    return `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
