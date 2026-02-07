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
  category: string;       // Department from Excel (מחלקה) - e.g. "מלצר", "טבח", "אחמשית"
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
const importSessions = new Map<string, { preview: ImportPreview; parsedData: ParsedWorker[]; timestamp: number; monthYear?: string }>();

// Clean up old sessions (older than 30 minutes)
function cleanOldSessions() {
  const now = Date.now();
  for (const [key, value] of importSessions.entries()) {
    if (now - value.timestamp > 30 * 60 * 1000) {
      importSessions.delete(key);
    }
  }
}

// Hebrew day letter to day-of-week offset (Sunday-based, 0=Sunday)
const HEBREW_DAY_MAP: { [key: string]: number } = {
  'א': 0, // Sunday
  'ב': 1, // Monday
  'ג': 2, // Tuesday
  'ד': 3, // Wednesday
  'ה': 4, // Thursday
  'ו': 5, // Friday
  'ש': 6, // Saturday
};

// Known department values mapped to job category names
const DEPARTMENT_TO_CATEGORY: { [key: string]: { category: string; isTipBased: boolean } } = {
  'מלצר': { category: 'waiter', isTipBased: true },
  'מלצרית': { category: 'waiter', isTipBased: true },
  'אחמשית': { category: 'waiter', isTipBased: true },
  'אח"מ': { category: 'waiter', isTipBased: true },
  'אחראי משמרת': { category: 'waiter', isTipBased: true },
  'אחראי': { category: 'waiter', isTipBased: true },
  'טבח': { category: 'cook', isTipBased: false },
  'טבחית': { category: 'cook', isTipBased: false },
  'סושימן': { category: 'sushi', isTipBased: false },
  'סושי': { category: 'sushi', isTipBased: false },
  'שוטף': { category: 'dishwasher', isTipBased: false },
  'שוטף כלים': { category: 'dishwasher', isTipBased: false },
};

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
    monthYear?: string,
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
      monthYear,
    });

    return preview;
  }

  /**
   * Apply the import - update worker hours in the database
   * For unmatched workers: auto-create user profiles and notify managers
   * Creates actual ShiftAssignment records so data flows into financial reports
   */
  async applyImport(
    sessionId: string,
    organizationId: string,
    workerMapping: { [excelName: string]: string },
    monthYear?: string,
    adminUserId?: string,
  ) {
    const session = importSessions.get(sessionId);
    if (!session) {
      throw new BadRequestException('Import session expired or not found. Please upload the file again.');
    }

    // Use monthYear from apply call or fall back to session
    const effectiveMonthYear = monthYear || session.monthYear;

    // Re-match with the user-supplied mapping
    const matchedWorkers = await this.matchWorkers(
      session.parsedData,
      organizationId,
      workerMapping,
    );

    // Fetch default hourly wage and per-category wages from settings
    const settings = await this.prisma.businessSettings.findUnique({
      where: { organizationId },
    });
    const defaultWage = (settings as any)?.defaultHourlyWage ?? 30;
    const defaultWages: { [key: string]: number } = (settings as any)?.defaultWages || {};

    // Fetch job categories for auto-assignment
    const jobCategories = await this.prisma.jobCategory.findMany({
      where: { organizationId, isActive: true },
    });

    const results: { name: string; userId: string; totalHours: number; status: string; isNew: boolean }[] = [];
    const newlyCreatedUsers: { id: string; name: string }[] = [];

    // Track names we've created in this batch for duplicate numbering
    const createdNames = new Map<string, number>(); // baseName -> count

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
        const newUser = await this.createWorkerProfile(
          worker.name,
          organizationId,
          defaultWage,
          defaultWages,
          worker.category,
          jobCategories,
          createdNames,
        );
        newlyCreatedUsers.push({ id: newUser.id, name: worker.name });

        // Set the matched user ID so we can create assignments
        worker.matchedUserId = newUser.id;

        results.push({
          name: worker.name,
          userId: newUser.id,
          totalHours: worker.totalHours,
          status: 'created',
          isNew: true,
        });
      }
    }

    // Create actual shift assignments if we have a month/year
    let assignmentsCreated = 0;
    console.log(`[Import] Effective monthYear: ${effectiveMonthYear}, workers to process: ${matchedWorkers.length}`);
    console.log(`[Import] Workers with matched IDs: ${matchedWorkers.filter(w => w.matchedUserId).length}`);
    for (const w of matchedWorkers) {
      console.log(`[Import] Worker: ${w.name}, matched: ${w.matchedUserId || 'NONE'}, shifts: ${w.shifts.length}, days: ${w.shifts.map(s => s.day).join(',')}`);
    }

    if (effectiveMonthYear) {
      assignmentsCreated = await this.createMonthlyShiftAssignments(
        matchedWorkers,
        organizationId,
        effectiveMonthYear,
        adminUserId,
      );
      console.log(`[Import] Assignments created: ${assignmentsCreated}`);
    } else {
      console.log(`[Import] No monthYear provided - skipping shift assignment creation`);
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
        assignmentsCreated,
      },
    };
  }

  /**
   * Create a new worker profile from an Excel name
   * Handles duplicate names with numbering, auto-assigns job category
   */
  private async createWorkerProfile(
    name: string,
    organizationId: string,
    defaultWage: number,
    defaultWages: { [key: string]: number },
    category: string,
    jobCategories: any[],
    createdNames: Map<string, number>,
  ) {
    // Split name into first/last - for single names, use it as firstName with empty lastName
    const nameParts = name.trim().split(/\s+/);
    let firstName = nameParts[0] || name;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    // Handle duplicate first names: check DB + current batch
    const existingWithSameName = await this.prisma.user.findMany({
      where: {
        organizationId,
        firstName: firstName,
      },
      select: { id: true, firstName: true },
    });

    const batchCount = createdNames.get(firstName) || 0;
    const totalExisting = existingWithSameName.length + batchCount;

    if (totalExisting > 0) {
      // Append number suffix: "יובל 2", "יובל 3", etc.
      firstName = `${firstName} ${totalExisting + 1}`;
    }

    // Track this name in the current batch
    createdNames.set(nameParts[0] || name, batchCount + 1);

    // Generate a placeholder email and password
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const placeholderEmail = `worker_${timestamp}_${randomSuffix}@placeholder.local`;
    const tempPassword = `Temp${timestamp}!`;
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Auto-assign job category based on department from Excel
    let jobCategoryId: string | null = null;
    let isTipBased = false;
    const categoryLower = (category || '').trim();

    if (categoryLower) {
      const mapping = DEPARTMENT_TO_CATEGORY[categoryLower];
      if (mapping) {
        // Find matching job category in the org
        const matchedCategory = jobCategories.find(
          jc => jc.name === mapping.category || jc.nameHe === categoryLower
        );
        if (matchedCategory) {
          jobCategoryId = matchedCategory.id;
        }
        isTipBased = mapping.isTipBased;
      } else {
        // Try to match by nameHe directly
        const matchedCategory = jobCategories.find(
          jc => jc.nameHe === categoryLower
        );
        if (matchedCategory) {
          jobCategoryId = matchedCategory.id;
        }
      }
    }

    // Determine the wage: use per-category wage if available, otherwise the general default
    let wage = defaultWage;
    if (categoryLower) {
      const mapping = DEPARTMENT_TO_CATEGORY[categoryLower];
      if (mapping && defaultWages[mapping.category] !== undefined) {
        wage = defaultWages[mapping.category];
      }
    }

    const userData: any = {
      email: placeholderEmail,
      passwordHash,
      firstName,
      lastName,
      role: 'EMPLOYEE' as any,
      employmentType: 'FULL_TIME' as any,
      organizationId,
      isApproved: true,
      isActive: true,
      hourlyWage: wage,
      isTipBased,
    };

    if (jobCategoryId) {
      userData.jobCategoryId = jobCategoryId;
    }

    const user = await this.prisma.user.create({
      data: userData,
    });

    return user;
  }

  /**
   * Create actual ShiftAssignment records from imported Excel data for a full month.
   * Distributes shifts across weeks based on day letter sequence.
   * OVERWRITES existing shift data for these workers in this month.
   */
  private async createMonthlyShiftAssignments(
    workers: MatchedWorker[],
    organizationId: string,
    monthYearStr: string, // "YYYY-MM" format
    adminUserId?: string,
  ): Promise<number> {
    const [yearStr, monthStr] = monthYearStr.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-12
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return 0;
    }

    // Calculate first and last day of the month
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0)); // Last day of month

    // Find all Sundays in this month (week start dates)
    const weekStartDates: Date[] = [];
    const d = new Date(monthStart);
    // Go back to the Sunday at or before monthStart
    while (d.getUTCDay() !== 0) {
      d.setUTCDate(d.getUTCDate() - 1);
    }
    // Collect all Sundays that overlap with this month
    while (d <= monthEnd) {
      weekStartDates.push(new Date(d));
      d.setUTCDate(d.getUTCDate() + 7);
    }

    if (weekStartDates.length === 0) return 0;

    // Get or find a creator for schedules
    let creatorId = adminUserId;
    if (!creatorId) {
      const admin = await this.prisma.user.findFirst({
        where: { organizationId, role: { in: ['ADMIN', 'MANAGER'] as any } },
        select: { id: true },
      });
      creatorId = admin?.id;
    }
    if (!creatorId) return 0;

    // Find or create WeeklySchedules for each week in the month
    const scheduleMap = new Map<string, any>(); // weekStartDate ISO -> schedule
    for (const wsd of weekStartDates) {
      let schedule = await this.prisma.weeklySchedule.findUnique({
        where: {
          organizationId_weekStartDate: {
            organizationId,
            weekStartDate: wsd,
          },
        },
      });
      if (!schedule) {
        schedule = await this.prisma.weeklySchedule.create({
          data: {
            organizationId,
            weekStartDate: wsd,
            status: 'PUBLISHED' as any,
            createdById: creatorId,
            publishedAt: new Date(),
          },
        });
      }
      scheduleMap.set(wsd.toISOString(), schedule);
    }

    // Get shift templates for time matching - create defaults if none exist
    let templates = await this.prisma.shiftTemplate.findMany({
      where: { organizationId, isActive: true },
      orderBy: { startTime: 'asc' },
    });
    if (templates.length === 0) {
      // Auto-create default shift templates so imports can work
      const defaultTemplates = [
        { name: 'משמרת בוקר', shiftType: 'MORNING', startTime: '11:00', endTime: '18:00', organizationId },
        { name: 'משמרת ערב', shiftType: 'EVENING', startTime: '18:00', endTime: '23:00', organizationId },
      ];
      for (const dt of defaultTemplates) {
        await this.prisma.shiftTemplate.create({ data: dt as any });
      }
      templates = await this.prisma.shiftTemplate.findMany({
        where: { organizationId, isActive: true },
        orderBy: { startTime: 'asc' },
      });
      if (templates.length === 0) return 0;
    }

    // Delete ALL existing shift assignments in this org for the entire month (full override)
    const scheduleIds = Array.from(scheduleMap.values()).map((s: any) => s.id);
    if (scheduleIds.length > 0) {
      await this.prisma.shiftAssignment.deleteMany({
        where: {
          scheduleId: { in: scheduleIds },
          shiftDate: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });
    }

    // Also clear existing CookWeeklyHours for this month (will be re-populated from import)
    await this.prisma.cookWeeklyHours.deleteMany({
      where: {
        organizationId,
        weekStart: {
          in: weekStartDates,
        },
      },
    });

    console.log(`[ShiftCreate] Month: ${monthYearStr}, monthStart: ${monthStart.toISOString()}, monthEnd: ${monthEnd.toISOString()}`);
    console.log(`[ShiftCreate] Week start dates: ${weekStartDates.map(d => d.toISOString()).join(', ')}`);
    console.log(`[ShiftCreate] Templates: ${templates.map(t => `${t.shiftType}(${(t as any).startTime})`).join(', ')}`);
    console.log(`[ShiftCreate] Schedules created/found: ${scheduleMap.size}`);

    // Build a map of day letter occurrences for each worker
    // For monthly data, shifts with the same day letter are in chronological order
    // First א = first Sunday of month, second א = second Sunday, etc.
    let assignmentsCreated = 0;

    for (const worker of workers) {
      if (!worker.matchedUserId) continue;

      // Group shifts by day letter, preserving order
      const dayOccurrences = new Map<string, ParsedShift[]>();
      for (const shift of worker.shifts) {
        const existing = dayOccurrences.get(shift.day) || [];
        existing.push(shift);
        dayOccurrences.set(shift.day, existing);
      }

      // For each day letter, distribute across weeks
      for (const [dayLetter, shifts] of dayOccurrences) {
        const dayOffset = HEBREW_DAY_MAP[dayLetter];
        if (dayOffset === undefined) continue;

        // Calculate all dates for this day-of-week in the month
        const datesForDay: Date[] = [];
        for (const wsd of weekStartDates) {
          const date = new Date(wsd);
          date.setUTCDate(date.getUTCDate() + dayOffset);
          // Only include if within the month
          if (date >= monthStart && date <= monthEnd) {
            datesForDay.push(date);
          }
        }

        // Assign each shift occurrence to the corresponding date
        for (let i = 0; i < shifts.length && i < datesForDay.length; i++) {
          const shift = shifts[i];
          const shiftDate = datesForDay[i];

          // Find which week this date belongs to
          const weekSunday = new Date(shiftDate);
          while (weekSunday.getUTCDay() !== 0) {
            weekSunday.setUTCDate(weekSunday.getUTCDate() - 1);
          }
          const schedule = scheduleMap.get(weekSunday.toISOString());
          if (!schedule) continue;

          const template = this.findBestTemplate(templates, shift.startTime);
          if (!template) continue;

          try {
            await this.prisma.shiftAssignment.create({
              data: {
                scheduleId: schedule.id,
                userId: worker.matchedUserId!,
                shiftTemplateId: template.id,
                shiftDate,
                actualStartTime: shift.startTime,
                actualEndTime: shift.endTime,
                actualHours: shift.totalHours,
                status: 'CONFIRMED' as any,
              },
            });
            assignmentsCreated++;
          } catch (err: any) {
            // May fail on unique constraint if data is weird - log and continue
            console.error(`[ShiftCreate] FAILED for ${worker.name} on ${shiftDate.toISOString()}: ${err.message}`);
          }
        }
      }
    }

    // Auto-populate CookWeeklyHours for cook/sushi workers
    await this.populateCookWeeklyHours(workers, organizationId, weekStartDates, monthStart, monthEnd);

    return assignmentsCreated;
  }

  /**
   * Auto-populate CookWeeklyHours from imported shift data.
   * For each cook worker, group their shifts by week and create CookWeeklyHours entries.
   */
  private async populateCookWeeklyHours(
    workers: MatchedWorker[],
    organizationId: string,
    weekStartDates: Date[],
    monthStart: Date,
    monthEnd: Date,
  ): Promise<void> {
    // Get all cook/sushi job category names
    const cookCategoryNames = ['cook', 'טבח', 'sushi', 'סושימן', 'sushiman'];

    for (const worker of workers) {
      if (!worker.matchedUserId) continue;
      if (worker.shifts.length === 0) continue;

      // Check if this worker is a cook/sushi (by category from Excel or by DB job category)
      const categoryMapping = DEPARTMENT_TO_CATEGORY[(worker.category || '').trim()];
      const isCook = categoryMapping && (categoryMapping.category === 'cook' || categoryMapping.category === 'sushi');

      // Also check DB user job category
      let isCookByDb = false;
      if (!isCook) {
        const user = await this.prisma.user.findUnique({
          where: { id: worker.matchedUserId },
          include: { jobCategory: { select: { name: true } } },
        });
        isCookByDb = user?.jobCategory ? cookCategoryNames.includes(user.jobCategory.name) : false;
      }

      if (!isCook && !isCookByDb) continue;

      // Get the user's hourly wage
      const user = await this.prisma.user.findUnique({
        where: { id: worker.matchedUserId },
        select: { hourlyWage: true },
      });
      const hourlyWage = user?.hourlyWage ?? 0;

      // Group shifts by week start date
      const weekHoursMap = new Map<string, number>(); // weekStartISO -> total hours

      for (const shift of worker.shifts) {
        const dayOffset = HEBREW_DAY_MAP[shift.day];
        if (dayOffset === undefined) continue;

        // Find the correct date for this shift occurrence within the month
        // We need to determine which specific date this shift falls on
        // by counting occurrences of this day letter
        const dayLetter = shift.day;
        const datesForDay: Date[] = [];
        for (const wsd of weekStartDates) {
          const date = new Date(wsd);
          date.setUTCDate(date.getUTCDate() + dayOffset);
          if (date >= monthStart && date <= monthEnd) {
            datesForDay.push(date);
          }
        }

        // Find the index of this shift for this day letter
        const shiftsForDay = worker.shifts.filter(s => s.day === dayLetter);
        const shiftIdx = shiftsForDay.indexOf(shift);
        if (shiftIdx < 0 || shiftIdx >= datesForDay.length) continue;

        const shiftDate = datesForDay[shiftIdx];

        // Find the week start for this shift date
        const weekSunday = new Date(shiftDate);
        while (weekSunday.getUTCDay() !== 0) {
          weekSunday.setUTCDate(weekSunday.getUTCDate() - 1);
        }
        weekSunday.setUTCHours(0, 0, 0, 0);
        const weekKey = weekSunday.toISOString();

        weekHoursMap.set(weekKey, (weekHoursMap.get(weekKey) || 0) + shift.totalHours);
      }

      // Create CookWeeklyHours entries for each week
      for (const [weekStartISO, totalHours] of weekHoursMap) {
        if (totalHours <= 0) continue;

        const weekStart = new Date(weekStartISO);
        const totalEarnings = totalHours * hourlyWage;

        try {
          await this.prisma.cookWeeklyHours.upsert({
            where: {
              organizationId_userId_weekStart: {
                organizationId,
                userId: worker.matchedUserId!,
                weekStart,
              },
            },
            update: {
              totalHours,
              hourlyWage,
              totalEarnings,
              notes: 'יובא מקובץ שעות',
            },
            create: {
              organizationId,
              userId: worker.matchedUserId!,
              weekStart,
              totalHours,
              hourlyWage,
              totalEarnings,
              notes: 'יובא מקובץ שעות',
            },
          });
        } catch (err) {
          console.error(`Failed to create cook hours for ${worker.name} week ${weekStartISO}:`, err);
        }
      }
    }
  }

  /**
   * Find the best matching shift template based on start time.
   * If start time is before 15:00, use MORNING template; otherwise EVENING.
   * If no match by time, use first available template.
   */
  private findBestTemplate(templates: any[], startTime: string | null): any {
    if (!startTime) {
      // No time info - return first template
      return templates[0] || null;
    }

    const [hours] = startTime.split(':').map(Number);

    // Determine shift type based on start hour
    if (hours < 15) {
      // Morning shift
      const morning = templates.find(t => t.shiftType === 'MORNING');
      if (morning) return morning;
    } else {
      // Evening shift
      const evening = templates.find(t => t.shiftType === 'EVENING' || t.shiftType === 'EVENING_CLOSE');
      if (evening) return evening;
    }

    // Fallback: match closest start time
    let bestTemplate = templates[0];
    let bestDiff = Infinity;

    for (const t of templates) {
      const [tHours, tMinutes] = t.startTime.split(':').map(Number);
      const tMins = tHours * 60 + (tMinutes || 0);
      const [sHours, sMinutes] = startTime.split(':').map(Number);
      const sMins = sHours * 60 + (sMinutes || 0);
      const diff = Math.abs(tMins - sMins);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestTemplate = t;
      }
    }

    return bestTemplate;
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
      name: `${u.firstName} ${u.lastName}`.trim(),
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
    let currentWorkerCategory: string = '';
    let pendingCategory: string = ''; // Category found before worker name (מחלקה row comes before שם עובד)
    let currentShifts: ParsedShift[] = [];
    let totalHours = 0;
    let hours100 = 0;
    let hours125 = 0;
    let hours150 = 0;
    let workDays = 0;

    // Known department/category keywords
    const knownDepartments = new Set(Object.keys(DEPARTMENT_TO_CATEGORY));

    for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx];
      if (!row || row.length === 0) continue;

      // Convert row to strings for easier matching
      const rowStr = row.map(cell => String(cell || '').trim());

      // Check for "מחלקה:" (department) header row - this often appears BEFORE "שם עובד:"
      const deptIdx = rowStr.findIndex(cell =>
        cell.includes('מחלקה:') || cell.includes('מחלקה')
      );
      if (deptIdx !== -1) {
        // Extract department value from this row
        for (const cell of rowStr) {
          const trimmed = cell.trim();
          // Check if the cell itself is a known department keyword
          if (knownDepartments.has(trimmed)) {
            pendingCategory = trimmed;
            break;
          }
          // Check if the value is after ":" in the same cell (e.g. "מחלקה: טבח")
          if (trimmed.includes('מחלקה') && trimmed.includes(':')) {
            const afterColon = trimmed.split(':').pop()?.trim() || '';
            if (afterColon && knownDepartments.has(afterColon)) {
              pendingCategory = afterColon;
              break;
            }
          }
        }
        // Also check adjacent cells for the department value
        if (!pendingCategory) {
          for (let i = 0; i < rowStr.length; i++) {
            if (i === deptIdx) continue;
            const trimmed = rowStr[i].trim();
            if (trimmed && knownDepartments.has(trimmed)) {
              pendingCategory = trimmed;
              break;
            }
          }
        }
        // Don't continue here - the row might also contain other info
      }

      // Check if this is a "שם עובד:" (worker name) header row
      const workerNameIdx = rowStr.findIndex(cell =>
        cell.includes('עובד:') || cell.includes('שם עובד')
      );

      if (workerNameIdx !== -1) {
        // Save previous worker if exists
        if (currentWorkerName) {
          workers.push({
            name: currentWorkerName,
            category: currentWorkerCategory,
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
        // Use the pending category (from מחלקה row that appeared before this שם עובד row)
        currentWorkerCategory = pendingCategory || '';
        pendingCategory = ''; // Reset pending for next worker
        currentShifts = [];
        totalHours = 0;
        hours100 = 0;
        hours125 = 0;
        hours150 = 0;
        workDays = 0;
        continue;
      }

      // Check for worker data rows - they have a name, day letter, and hours
      const hebrewDays = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

      if (currentWorkerName === null) {
        // Try to find worker name from data rows directly
        // The Excel shows rows like: "אחמשית | יובל | א | 0 | 0 | 5.36 | 0 | 5:22 | 0:22 | 19:00 | ###"
        // Worker name appears in "שם" column and category in "עובד" column (מחלקה)

        // Look for rows that have time patterns (HH:MM) which indicate shift data
        const hasTimePattern = rowStr.some(cell => /^\d{1,2}:\d{2}$/.test(cell));
        if (!hasTimePattern) continue;

        // This is likely a data row without a prior worker header
        // Extract name, day, and category from the row
        let nameFound = '';
        let dayFound = '';
        let categoryFound = '';

        for (const cell of rowStr) {
          if (hebrewDays.includes(cell) && !dayFound) {
            dayFound = cell;
          } else if (cell.length > 1 && /^[\u0590-\u05FF\s]+$/.test(cell)) {
            // Multi-character Hebrew word - could be name or department
            const trimmed = cell.trim();
            if (knownDepartments.has(trimmed)) {
              categoryFound = trimmed;
            } else if (!nameFound && trimmed.length > 1) {
              nameFound = trimmed;
            }
          }
        }

        if (nameFound) {
          // Check if we already have this worker
          let existingWorker = workers.find(w => w.name === nameFound);
          if (!existingWorker) {
            existingWorker = {
              name: nameFound,
              category: categoryFound,
              shifts: [],
              totalHours: 0,
              hours100: 0,
              hours125: 0,
              hours150: 0,
              workDays: 0,
            };
            workers.push(existingWorker);
          } else if (categoryFound && !existingWorker.category) {
            existingWorker.category = categoryFound;
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

      // Regular data row - extract shift data and possibly category
      let dayFound = '';
      for (const cell of rowStr) {
        if (hebrewDays.includes(cell)) {
          dayFound = cell;
          break;
        }
      }

      // Try to extract category from the row (first known department keyword)
      if (!currentWorkerCategory) {
        for (const cell of rowStr) {
          const trimmed = cell.trim();
          if (knownDepartments.has(trimmed)) {
            currentWorkerCategory = trimmed;
            break;
          }
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
        category: currentWorkerCategory,
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
    // Excel columns (RTL): שם | יום | שבת | הפסקה | 150% | 125% | 100% | סה"כ | יציאה | כניסה | תאריך
    let totalHours = 0;
    let startTime: string | null = null;
    let endTime: string | null = null;

    const timeValues: string[] = [];
    const numberValues: number[] = [];
    const durationValues: number[] = []; // For H:MM format hours (like 5:58 = 5.97h)

    for (const cell of row) {
      const trimmed = String(cell).trim();
      if (!trimmed || trimmed === '0') continue;

      // Check for time pattern HH:MM or H:MM
      if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
        const [h, m] = trimmed.split(':').map(Number);
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
          const hoursValue = h + m / 60;
          // Classify: clock times (entry/exit) are typically >= 6:00 and <= 23:59
          // Duration hours (total worked) are typically < 15 hours
          if (h >= 6 && h <= 23) {
            timeValues.push(trimmed); // Likely a clock time (entry/exit)
          }
          // If it looks like duration (under 15 hours), also track as duration
          if (hoursValue > 0 && hoursValue < 15) {
            durationValues.push(hoursValue);
          }
        }
      }

      // Check for decimal hours (like 5.36, 6.26)
      const num = parseFloat(trimmed);
      if (!isNaN(num) && num > 0 && num < 24 && trimmed.includes('.')) {
        numberValues.push(num);
      }
    }

    // Separate clock times from duration values
    // Clock times: typically >= 6:00 (entry around 8-18, exit around 15-00)
    // Sort time values by hour to identify entry (earlier) and exit (later)
    // In RTL Excel: last time column = entry (כניסה), second to last = exit (יציאה)
    if (timeValues.length >= 2) {
      startTime = timeValues[timeValues.length - 1]; // Last = entry (כניסה)
      endTime = timeValues[timeValues.length - 2];   // Second to last = exit (יציאה)
    } else if (timeValues.length === 1) {
      startTime = timeValues[0];
    }

    // Total hours - prefer decimal values (like 5.96), then duration H:MM values
    if (numberValues.length > 0) {
      totalHours = Math.max(...numberValues);
    }

    // If no decimal number found, use the smallest duration value
    // (the total hours column is usually the smallest H:MM value)
    if (totalHours === 0 && durationValues.length > 0) {
      // The duration is usually the value that doesn't match start/end times
      const startHours = startTime ? parseInt(startTime.split(':')[0]) + parseInt(startTime.split(':')[1]) / 60 : -1;
      const endHours = endTime ? parseInt(endTime.split(':')[0]) + parseInt(endTime.split(':')[1]) / 60 : -1;
      
      for (const dur of durationValues) {
        // Skip values that match start or end times (within 0.1h tolerance)
        if (Math.abs(dur - startHours) < 0.1) continue;
        if (Math.abs(dur - endHours) < 0.1) continue;
        // Pick the first non-clock-time duration
        if (dur > 0 && dur < 15) {
          totalHours = dur;
          break;
        }
      }
    }

    // If still no hours, try to calculate from start/end times
    if (totalHours === 0 && startTime && endTime) {
      const [sh, sm] = startTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      let diff = (eh - sh) + (em - sm) / 60;
      if (diff < 0) diff += 24;
      totalHours = diff;
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
            matchedUserName: `${user.firstName} ${user.lastName}`.trim(),
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
          matchedUserName: `${exactFirstMatch.firstName} ${exactFirstMatch.lastName}`.trim(),
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
          matchedUserName: `${fullNameMatch.firstName} ${fullNameMatch.lastName}`.trim(),
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
          matchedUserName: `${lastNameMatch.firstName} ${lastNameMatch.lastName}`.trim(),
          matchStatus: 'matched' as const,
          matchCandidates: [],
        };
      }

      // No exact match found - mark as unmatched
      // Provide all users as candidates for manual selection
      const candidates = users.map(u => ({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
      }));

      return {
        ...worker,
        matchedUserId: null,
        matchedUserName: null,
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
