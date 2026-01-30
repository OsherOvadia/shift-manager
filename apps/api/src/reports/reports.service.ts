import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getWeeklyShiftCosts(organizationId: string, weekStartDate: Date) {
    const startDate = this.normalizeToWeekStart(weekStartDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    // Get all shift assignments for the week
    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        schedule: { organizationId },
        shiftDate: {
          gte: startDate,
          lt: endDate,
        },
        status: { not: 'CANCELLED' },
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
        shiftTemplate: {
          select: {
            id: true,
            name: true,
            shiftType: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    // Calculate hours for each shift
    const calculateHours = (startTime: string, endTime: string): number => {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      
      let hours = endHour - startHour + (endMin - startMin) / 60;
      // Handle overnight shifts
      if (hours < 0) hours += 24;
      return hours;
    };

    // Calculate costs by employee
    const employeeCosts = new Map<string, {
      user: any;
      totalHours: number;
      totalCost: number;
      shifts: any[];
    }>();

    for (const assignment of assignments) {
      const hours = calculateHours(
        assignment.shiftTemplate.startTime,
        assignment.shiftTemplate.endTime
      );
      const cost = hours * assignment.user.hourlyWage;

      if (!employeeCosts.has(assignment.user.id)) {
        employeeCosts.set(assignment.user.id, {
          user: assignment.user,
          totalHours: 0,
          totalCost: 0,
          shifts: [],
        });
      }

      const record = employeeCosts.get(assignment.user.id)!;
      record.totalHours += hours;
      record.totalCost += cost;
      record.shifts.push({
        date: assignment.shiftDate,
        shiftTemplate: assignment.shiftTemplate,
        hours,
        cost,
      });
    }

    // Calculate costs by job category
    const categoryCosts = new Map<string, {
      category: any;
      totalHours: number;
      totalCost: number;
      employeeCount: number;
    }>();

    for (const [, record] of employeeCosts) {
      const categoryId = record.user.jobCategory?.id || 'uncategorized';
      
      if (!categoryCosts.has(categoryId)) {
        categoryCosts.set(categoryId, {
          category: record.user.jobCategory || { id: 'uncategorized', name: 'Uncategorized', nameHe: 'ללא קטגוריה', color: '#6b7280' },
          totalHours: 0,
          totalCost: 0,
          employeeCount: 0,
        });
      }

      const catRecord = categoryCosts.get(categoryId)!;
      catRecord.totalHours += record.totalHours;
      catRecord.totalCost += record.totalCost;
      catRecord.employeeCount += 1;
    }

    // Daily breakdown
    const dailyCosts: { date: Date; totalHours: number; totalCost: number; employeeCount: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const dayAssignments = assignments.filter(
        a => new Date(a.shiftDate).toDateString() === date.toDateString()
      );

      let totalHours = 0;
      let totalCost = 0;
      const employeeIds = new Set<string>();

      for (const assignment of dayAssignments) {
        const hours = calculateHours(
          assignment.shiftTemplate.startTime,
          assignment.shiftTemplate.endTime
        );
        totalHours += hours;
        totalCost += hours * assignment.user.hourlyWage;
        employeeIds.add(assignment.user.id);
      }

      dailyCosts.push({
        date,
        totalHours,
        totalCost,
        employeeCount: employeeIds.size,
      });
    }

    // Total summary
    let totalHours = 0;
    let totalCost = 0;
    for (const [, record] of employeeCosts) {
      totalHours += record.totalHours;
      totalCost += record.totalCost;
    }

    return {
      weekStartDate: startDate,
      summary: {
        totalHours,
        totalCost,
        employeeCount: employeeCosts.size,
        shiftCount: assignments.length,
      },
      byEmployee: Array.from(employeeCosts.values()).sort((a, b) => b.totalCost - a.totalCost),
      byCategory: Array.from(categoryCosts.values()).sort((a, b) => b.totalCost - a.totalCost),
      byDay: dailyCosts,
    };
  }

  async getMonthlyOverview(organizationId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        schedule: { organizationId },
        shiftDate: {
          gte: startDate,
          lt: endDate,
        },
        status: { not: 'CANCELLED' },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            hourlyWage: true,
          },
        },
        shiftTemplate: {
          select: {
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    const calculateHours = (startTime: string, endTime: string): number => {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      let hours = endHour - startHour + (endMin - startMin) / 60;
      if (hours < 0) hours += 24;
      return hours;
    };

    let totalHours = 0;
    let totalCost = 0;
    const employeeIds = new Set<string>();

    for (const assignment of assignments) {
      const hours = calculateHours(
        assignment.shiftTemplate.startTime,
        assignment.shiftTemplate.endTime
      );
      totalHours += hours;
      totalCost += hours * assignment.user.hourlyWage;
      employeeIds.add(assignment.user.id);
    }

    return {
      year,
      month,
      totalHours,
      totalCost,
      employeeCount: employeeIds.size,
      shiftCount: assignments.length,
    };
  }

  private normalizeToWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
