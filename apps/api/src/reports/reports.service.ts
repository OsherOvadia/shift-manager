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

    // Calculate hours for each shift - use actual times if available
    const calculateHours = (assignment: any): number => {
      // If actual hours were manually entered, use those
      if (assignment.actualHours !== null && assignment.actualHours !== undefined) {
        return assignment.actualHours;
      }
      
      // If actual start/end times are available, calculate from those
      const startTime = assignment.actualStartTime || assignment.shiftTemplate.startTime;
      const endTime = assignment.actualEndTime || assignment.shiftTemplate.endTime;
      
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
      baseWageTotal: number;
      totalWorkerPayment: number;
      shifts: any[];
    }>();

    for (const assignment of assignments) {
      const hours = calculateHours(assignment);
      
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
          baseWageTotal: 0,
          totalWorkerPayment: 0,
          shifts: [],
        });
      }

      const record = employeeCosts.get(assignment.user.id)!;
      record.totalHours += hours;
      record.totalCost += cost;
      record.totalTips += tips;
      record.managerPayment += managerPayment;
      
      // Calculate base wage total and total worker payment
      if (assignment.user.isTipBased && assignment.user.baseHourlyWage) {
        record.baseWageTotal = record.totalHours * assignment.user.baseHourlyWage;
        record.totalWorkerPayment = record.baseWageTotal; // Tips are extra, not salary
        record.tipsCoverSalary = record.totalTips >= record.baseWageTotal;
      } else {
        record.baseWageTotal = record.totalHours * assignment.user.hourlyWage;
        record.totalWorkerPayment = record.baseWageTotal;
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
        const hours = calculateHours(assignment);
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
    // Don't calculate totalTips from employeeCosts - it would count tips multiple times per shift
    // let totalTips = 0;
    for (const [, record] of employeeCosts) {
      totalHours += record.totalHours;
      totalCost += record.totalCost;
      // totalTips += record.totalTips; // REMOVED: This causes double counting
    }

    // Calculate total revenue from shift assignments (sitting + takeaway + delivery)
    // Group by shift to avoid counting same revenue multiple times
    const revenueByShift = new Map<string, {
      sitting: number;
      takeaway: number;
      delivery: number;
      tips: number;
    }>();
    
    for (const assignment of assignments) {
      const dateStr = new Date(assignment.shiftDate).toISOString().split('T')[0];
      const shiftType = assignment.shiftTemplate.shiftType === 'EVENING_CLOSE' 
        ? 'EVENING' 
        : assignment.shiftTemplate.shiftType;
      const shiftKey = `${dateStr}_${shiftType}`;
      
      // Only count each shift once (first worker's data represents the whole shift)
      if (!revenueByShift.has(shiftKey)) {
        revenueByShift.set(shiftKey, {
          sitting: assignment.sittingTips || 0,
          takeaway: assignment.takeawayTips || 0,
          delivery: assignment.deliveryTips || 0,
          tips: assignment.tipsEarned || 0,
        });
      }
    }
    
    // Calculate totals from unique shifts (correct way - count each shift once!)
    let totalRevenue = 0;
    let totalTips = 0;
    
    for (const [, shiftRevenue] of revenueByShift) {
      totalRevenue += shiftRevenue.sitting + shiftRevenue.takeaway + shiftRevenue.delivery;
      totalTips += shiftRevenue.tips;
    }
    
    // Calculate revenue and tips by day
    const revenueByDay = new Map<string, number>();
    const tipsByDay = new Map<string, number>();
    for (const [shiftKey, shiftRevenue] of revenueByShift) {
      const dateStr = shiftKey.split('_')[0];
      const revenue = shiftRevenue.sitting + shiftRevenue.takeaway + shiftRevenue.delivery;
      revenueByDay.set(dateStr, (revenueByDay.get(dateStr) || 0) + revenue);
      tipsByDay.set(dateStr, (tipsByDay.get(dateStr) || 0) + shiftRevenue.tips);
    }

    // Add revenue and tips data to daily costs
    const dailyCostsWithRevenue = dailyCosts.map(day => {
      const dateKey = day.date.toISOString().split('T')[0];
      const revenue = revenueByDay.get(dateKey) || 0;
      const tips = tipsByDay.get(dateKey) || 0;
      const profitMargin = revenue > 0 ? ((revenue - day.totalCost) / revenue) * 100 : 0;
      const salaryPercentage = revenue > 0 ? (day.totalCost / revenue) * 100 : 0;
      
      return {
        ...day,
        revenue,
        tips,
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

    // Calculate hours - use actual times if available
    const calculateHours = (assignment: any): number => {
      if (assignment.actualHours !== null && assignment.actualHours !== undefined) {
        return assignment.actualHours;
      }
      const startTime = assignment.actualStartTime || assignment.shiftTemplate.startTime;
      const endTime = assignment.actualEndTime || assignment.shiftTemplate.endTime;
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
      const hours = calculateHours(assignment);
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

  /**
   * Get worker hours summary (weekly and monthly)
   */
  async getWorkerHoursSummary(userId: string, organizationId: string) {
    const now = new Date();
    
    // Get week start and end
    const weekStart = this.normalizeToWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

    // Get month start and end
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Verify user belongs to organization
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('המשתמש לא נמצא');
    }

    // Get weekly assignments
    const weeklyAssignments = await this.prisma.shiftAssignment.findMany({
      where: {
        userId,
        schedule: { organizationId },
        shiftDate: {
          gte: weekStart,
          lt: weekEnd,
        },
        status: { not: 'CANCELLED' },
      },
      include: {
        shiftTemplate: {
          select: {
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    // Get monthly assignments
    const monthlyAssignments = await this.prisma.shiftAssignment.findMany({
      where: {
        userId,
        schedule: { organizationId },
        shiftDate: {
          gte: monthStart,
          lt: monthEnd,
        },
        status: { not: 'CANCELLED' },
      },
      include: {
        shiftTemplate: {
          select: {
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    // Calculate hours using actual times if available
    const calculateHours = (assignment: any): number => {
      if (assignment.actualHours !== null && assignment.actualHours !== undefined) {
        return assignment.actualHours;
      }
      const startTime = assignment.actualStartTime || assignment.shiftTemplate.startTime;
      const endTime = assignment.actualEndTime || assignment.shiftTemplate.endTime;
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      let hours = endHour - startHour + (endMin - startMin) / 60;
      if (hours < 0) hours += 24;
      return hours;
    };

    const weeklyHours = weeklyAssignments.reduce((sum, a) => sum + calculateHours(a), 0);
    const monthlyHours = monthlyAssignments.reduce((sum, a) => sum + calculateHours(a), 0);

    return {
      userId,
      weeklyHours: Math.round(weeklyHours * 100) / 100,
      monthlyHours: Math.round(monthlyHours * 100) / 100,
      weeklyShiftCount: weeklyAssignments.length,
      monthlyShiftCount: monthlyAssignments.length,
      weekStart: weekStart.toISOString(),
      monthStart: monthStart.toISOString(),
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
