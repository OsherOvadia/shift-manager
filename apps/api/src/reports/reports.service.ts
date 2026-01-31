import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DailyRevenuesService } from '../daily-revenues/daily-revenues.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyRevenuesService: DailyRevenuesService,
  ) {}

  async getWeeklyShiftCosts(organizationId: string, weekStartDate: Date) {
    const startDate = this.normalizeToWeekStart(weekStartDate);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 7);

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
            baseHourlyWage: true,
            isTipBased: true,
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
      totalTips: number;
      managerPayment: number;
      tipsCoverSalary: boolean;
      shifts: any[];
    }>();

    for (const assignment of assignments) {
      const hours = calculateHours(
        assignment.shiftTemplate.startTime,
        assignment.shiftTemplate.endTime
      );
      
      let cost = 0;
      let managerPayment = 0;
      let tipsCoverSalary = false;
      const tips = assignment.tipsEarned || 0;

      // For tip-based employees (waiters)
      if (assignment.user.isTipBased && assignment.user.baseHourlyWage) {
        const baseHourlyWage = assignment.user.baseHourlyWage;
        const tipRate = hours > 0 ? tips / hours : 0;
        
        if (tipRate >= baseHourlyWage) {
          // Tips cover the base salary
          managerPayment = 0;
          tipsCoverSalary = true;
        } else {
          // Manager pays the difference
          managerPayment = (baseHourlyWage - tipRate) * hours;
          tipsCoverSalary = false;
        }
        cost = managerPayment; // Only count manager's payment in cost
      } else {
        // Regular employees
        cost = hours * assignment.user.hourlyWage;
        managerPayment = cost;
      }

      if (!employeeCosts.has(assignment.user.id)) {
        employeeCosts.set(assignment.user.id, {
          user: assignment.user,
          totalHours: 0,
          totalCost: 0,
          totalTips: 0,
          managerPayment: 0,
          tipsCoverSalary: false,
          shifts: [],
        });
      }

      const record = employeeCosts.get(assignment.user.id)!;
      record.totalHours += hours;
      record.totalCost += cost;
      record.totalTips += tips;
      record.managerPayment += managerPayment;
      if (assignment.user.isTipBased) {
        record.tipsCoverSalary = record.totalTips >= (assignment.user.baseHourlyWage || 0) * record.totalHours;
      }
      record.shifts.push({
        assignmentId: assignment.id,
        date: assignment.shiftDate,
        shiftTemplate: assignment.shiftTemplate,
        hours,
        cost,
        tips,
        managerPayment,
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
      date.setUTCDate(date.getUTCDate() + i);
      
      // Compare dates using UTC date strings to avoid timezone issues
      const dateStr = date.toISOString().split('T')[0];
      const dayAssignments = assignments.filter(
        a => new Date(a.shiftDate).toISOString().split('T')[0] === dateStr
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
        
        // Calculate cost based on whether employee is tip-based
        let cost = 0;
        if (assignment.user.isTipBased && assignment.user.baseHourlyWage) {
          const tips = assignment.tipsEarned || 0;
          const tipRate = hours > 0 ? tips / hours : 0;
          const baseHourlyWage = assignment.user.baseHourlyWage;
          
          if (tipRate < baseHourlyWage) {
            cost = (baseHourlyWage - tipRate) * hours; // Manager pays the difference
          }
        } else {
          cost = hours * assignment.user.hourlyWage;
        }
        
        totalCost += cost;
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
    let totalTips = 0;
    for (const [, record] of employeeCosts) {
      totalHours += record.totalHours;
      totalCost += record.totalCost;
      totalTips += record.totalTips;
    }

    // Get daily revenues for the week
    const dailyRevenues = await this.dailyRevenuesService.findByDateRange(
      organizationId,
      startDate,
      endDate,
    );

    // Calculate total revenue and profit margin
    let totalRevenue = 0;
    const revenueByDay = new Map<string, number>();
    for (const revenue of dailyRevenues) {
      totalRevenue += revenue.totalRevenue;
      revenueByDay.set(revenue.date.toISOString().split('T')[0], revenue.totalRevenue);
    }

    // Add revenue data to daily costs
    const dailyCostsWithRevenue = dailyCosts.map(day => {
      const dateKey = day.date.toISOString().split('T')[0];
      const revenue = revenueByDay.get(dateKey) || 0;
      const profitMargin = revenue > 0 ? ((revenue - day.totalCost) / revenue) * 100 : 0;
      const salaryPercentage = revenue > 0 ? (day.totalCost / revenue) * 100 : 0;
      
      return {
        ...day,
        revenue,
        profitMargin,
        salaryPercentage,
      };
    });

    const overallProfitMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;
    const overallSalaryPercentage = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;

    return {
      weekStartDate: startDate,
      summary: {
        totalHours,
        totalCost,
        totalTips,
        totalRevenue,
        profitMargin: overallProfitMargin,
        salaryPercentage: overallSalaryPercentage,
        employeeCount: employeeCosts.size,
        shiftCount: assignments.length,
      },
      byEmployee: Array.from(employeeCosts.values()).sort((a, b) => b.totalCost - a.totalCost),
      byCategory: Array.from(categoryCosts.values()).sort((a, b) => b.totalCost - a.totalCost),
      byDay: dailyCostsWithRevenue,
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
    // Use UTC methods to avoid timezone shifts when parsing ISO dates
    const day = d.getUTCDay();
    d.setUTCDate(d.getUTCDate() - day);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
}
