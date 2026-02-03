import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCookHoursDto } from './dto/create-cook-hours.dto';
import { UpdateCookHoursDto } from './dto/update-cook-hours.dto';

@Injectable()
export class CookPayrollService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all employees with job category 'cook' (or similar)
   */
  async getCooks(organizationId: string) {
    const cooks = await this.prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        jobCategory: {
          name: {
            in: ['cook', 'טבח', 'sushiman', 'סושימן'],
          },
        },
      },
      include: {
        jobCategory: {
          select: {
            id: true,
            name: true,
            nameHe: true,
            color: true,
          },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    return cooks.map(cook => ({
      id: cook.id,
      firstName: cook.firstName,
      lastName: cook.lastName,
      email: cook.email,
      hourlyWage: cook.hourlyWage,
      jobCategory: cook.jobCategory,
    }));
  }

  /**
   * Get cook payroll data for a specific week
   */
  async getWeeklyCookPayroll(organizationId: string, weekStart: Date) {
    // Normalize to start of week
    const normalizedWeekStart = this.normalizeToWeekStart(weekStart);

    // Get all cooks
    const cooks = await this.getCooks(organizationId);

    // Get existing cook hours entries for this week
    const cookHoursEntries = await this.prisma.cookWeeklyHours.findMany({
      where: {
        organizationId,
        weekStart: normalizedWeekStart,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hourlyWage: true,
            jobCategory: {
              select: {
                id: true,
                name: true,
                nameHe: true,
                color: true,
              },
            },
          },
        },
      },
    });

    // Create a map of existing entries
    const hoursMap = new Map(
      cookHoursEntries.map(entry => [entry.userId, entry])
    );

    // Build payroll data for all cooks
    const payrollData = cooks.map(cook => {
      const existingEntry = hoursMap.get(cook.id);
      return {
        userId: cook.id,
        firstName: cook.firstName,
        lastName: cook.lastName,
        jobCategory: cook.jobCategory,
        hourlyWage: existingEntry?.hourlyWage ?? cook.hourlyWage,
        totalHours: existingEntry?.totalHours ?? 0,
        totalEarnings: existingEntry?.totalEarnings ?? 0,
        notes: existingEntry?.notes ?? '',
        entryId: existingEntry?.id ?? null,
      };
    });

    // Calculate totals
    const totals = {
      totalHours: payrollData.reduce((sum, p) => sum + p.totalHours, 0),
      totalEarnings: payrollData.reduce((sum, p) => sum + p.totalEarnings, 0),
      cookCount: payrollData.length,
    };

    return {
      weekStart: normalizedWeekStart.toISOString(),
      cooks: payrollData,
      totals,
    };
  }

  /**
   * Create or update cook hours entry
   */
  async upsertCookHours(dto: CreateCookHoursDto, organizationId: string) {
    const weekStart = this.normalizeToWeekStart(new Date(dto.weekStart));
    const totalEarnings = dto.totalHours * dto.hourlyWage;

    // Verify user exists and is a cook
    const user = await this.prisma.user.findFirst({
      where: {
        id: dto.userId,
        organizationId,
        isActive: true,
      },
      include: {
        jobCategory: true,
      },
    });

    if (!user) {
      throw new NotFoundException('העובד לא נמצא');
    }

    // Upsert the entry
    const entry = await this.prisma.cookWeeklyHours.upsert({
      where: {
        organizationId_userId_weekStart: {
          organizationId,
          userId: dto.userId,
          weekStart,
        },
      },
      update: {
        totalHours: dto.totalHours,
        hourlyWage: dto.hourlyWage,
        totalEarnings,
        notes: dto.notes,
      },
      create: {
        organizationId,
        userId: dto.userId,
        weekStart,
        totalHours: dto.totalHours,
        hourlyWage: dto.hourlyWage,
        totalEarnings,
        notes: dto.notes,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return entry;
  }

  /**
   * Update cook hours entry
   */
  async updateCookHours(id: string, dto: UpdateCookHoursDto, organizationId: string) {
    const entry = await this.prisma.cookWeeklyHours.findFirst({
      where: { id, organizationId },
    });

    if (!entry) {
      throw new NotFoundException('רשומת שעות לא נמצאה');
    }

    const totalHours = dto.totalHours ?? entry.totalHours;
    const hourlyWage = dto.hourlyWage ?? entry.hourlyWage;
    const totalEarnings = totalHours * hourlyWage;

    return this.prisma.cookWeeklyHours.update({
      where: { id },
      data: {
        totalHours: dto.totalHours,
        hourlyWage: dto.hourlyWage,
        totalEarnings,
        notes: dto.notes,
      },
    });
  }

  /**
   * Get weekly comparison (last N weeks)
   */
  async getWeeklyComparison(organizationId: string, weeksBack: number = 4) {
    const comparisons = [];
    const today = new Date();

    for (let i = 0; i < weeksBack; i++) {
      const weekDate = new Date(today);
      weekDate.setDate(weekDate.getDate() - i * 7);
      const weekStart = this.normalizeToWeekStart(weekDate);

      const entries = await this.prisma.cookWeeklyHours.findMany({
        where: {
          organizationId,
          weekStart,
        },
      });

      const totalHours = entries.reduce((sum, e) => sum + e.totalHours, 0);
      const totalEarnings = entries.reduce((sum, e) => sum + e.totalEarnings, 0);

      comparisons.push({
        weekStart: weekStart.toISOString(),
        weekLabel: this.formatWeekLabel(weekStart),
        totalHours,
        totalEarnings,
        cookCount: entries.length,
      });
    }

    return comparisons.reverse(); // Oldest first
  }

  /**
   * Delete cook hours entry
   */
  async deleteCookHours(id: string, organizationId: string) {
    const entry = await this.prisma.cookWeeklyHours.findFirst({
      where: { id, organizationId },
    });

    if (!entry) {
      throw new NotFoundException('רשומת שעות לא נמצאה');
    }

    await this.prisma.cookWeeklyHours.delete({
      where: { id },
    });

    return { message: 'רשומת השעות נמחקה בהצלחה' };
  }

  /**
   * Normalize date to week start (Sunday)
   */
  private normalizeToWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day;
    d.setUTCDate(diff);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }

  /**
   * Format week label for display
   */
  private formatWeekLabel(weekStart: Date): string {
    const endDate = new Date(weekStart);
    endDate.setDate(endDate.getDate() + 6);
    
    const startDay = weekStart.getDate();
    const startMonth = weekStart.getMonth() + 1;
    const endDay = endDate.getDate();
    const endMonth = endDate.getMonth() + 1;

    return `${startDay}/${startMonth} - ${endDay}/${endMonth}`;
  }
}
