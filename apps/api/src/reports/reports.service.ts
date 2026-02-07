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

    // Get cook payroll for the week
    const cookPayroll = await this.prisma.cookWeeklyHours.findMany({
      where: {
        organizationId,
        weekStart: startDate,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
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

    // Merge cook payroll costs into employeeCosts (avoid duplicates)
    // If a cook already has shift assignments, merge their payroll data
    // Otherwise, add them as a new entry
    const totalCookHours = cookPayroll.reduce((sum, c) => sum + c.totalHours, 0);
    const totalCookCost = cookPayroll.reduce((sum, c) => sum + c.totalEarnings, 0);

    for (const cook of cookPayroll) {
      if (employeeCosts.has(cook.user.id)) {
        // Cook already exists (has shift assignments) - merge payroll data
        const existing = employeeCosts.get(cook.user.id)!;
        existing.totalHours += cook.totalHours;
        existing.totalCost += cook.totalEarnings;
        existing.managerPayment += cook.totalEarnings;
        existing.baseWageTotal += cook.totalEarnings;
        existing.totalWorkerPayment += cook.totalEarnings;
        
        console.log(`[Reports] Merged cook payroll for ${cook.user.firstName} (${cook.user.id})`);
      } else {
        // New cook (no shift assignments) - add as new entry
        employeeCosts.set(cook.user.id, {
          user: cook.user,
          totalHours: cook.totalHours,
          totalCost: cook.totalEarnings,
          totalTips: 0,
          managerPayment: cook.totalEarnings,
          tipsCoverSalary: false,
          baseWageTotal: cook.totalEarnings,
          totalWorkerPayment: cook.totalEarnings,
          shifts: [],
        });
        
        console.log(`[Reports] Added new cook ${cook.user.firstName} (${cook.user.id}) from payroll only`);
      }
    }

    // Convert to array (now includes merged cook data, no duplicates)
    const allEmployees = Array.from(employeeCosts.values())
      .sort((a, b) => b.totalCost - a.totalCost);
    
    console.log(`[Reports] Total unique employees: ${allEmployees.length}`);

    // Update byCategory with cook payroll data (already merged into employeeCosts above)
    // Rebuild category costs from the merged employeeCosts to avoid double-counting
    categoryCosts.clear();
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

    // Add cook costs to total cost (waiters' tips CANNOT pay for cook salaries)
    const totalCostWithCooks = totalCost + totalCookCost;
    const totalHoursWithCooks = totalHours + totalCookHours;

    const overallProfitMargin = totalRevenue > 0 ? ((totalRevenue - totalCostWithCooks) / totalRevenue) * 100 : 0;
    const overallSalaryPercentage = totalRevenue > 0 ? (totalCostWithCooks / totalRevenue) * 100 : 0;

    // Extract kitchen staff from merged allEmployees for cookPayroll section
    const cookCosts = allEmployees.filter(emp => 
      emp.user.jobCategory?.name === 'cook' || emp.user.jobCategory?.name === 'sushi'
    );

    return {
      weekStartDate: startDate,
      summary: {
        totalHours: totalHoursWithCooks,
        totalCost: totalCostWithCooks,
        totalTips,
        totalRevenue,
        profitMargin: overallProfitMargin,
        salaryPercentage: overallSalaryPercentage,
        employeeCount: employeeCosts.size, // Now includes all employees (merged)
        shiftCount: assignments.length,
        // Separate breakdown
        waiterHours: totalHours,
        waiterCost: totalCost,
        cookHours: totalCookHours,
        cookCost: totalCookCost,
      },
      byEmployee: allEmployees,
      byCategory: Array.from(categoryCosts.values()).sort((a, b) => b.totalCost - a.totalCost),
      byDay: dailyCostsWithRevenue,
      cookPayroll: cookCosts.sort((a, b) => b.totalCost - a.totalCost),
    };
  }

  async getMonthlyOverview(organizationId: string, year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // Get cook payroll for the month
    const cookPayroll = await this.prisma.cookWeeklyHours.findMany({
      where: {
        organizationId,
        weekStart: {
          gte: startDate,
          lt: endDate,
        },
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

    // Get shift assignments
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

    // Get monthly expenses
    const monthlyExpenses = await this.prisma.monthlyExpenses.findUnique({
      where: {
        organizationId_year_month: {
          organizationId,
          year,
          month,
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
    let totalEmployeeCost = 0;
    let totalCardTips = 0;
    let totalCashTips = 0;
    const employeeIds = new Set<string>();

    // Calculate waiter costs and tips
    for (const assignment of assignments) {
      const hours = calculateHours(assignment);
      totalHours += hours;
      
      // Calculate cost based on whether employee is tip-based
      let cost = 0;
      if (assignment.user.isTipBased && assignment.user.baseHourlyWage) {
        const cardTips = assignment.tipsEarned || 0;
        const tipRate = hours > 0 ? cardTips / hours : 0;
        const baseHourlyWage = assignment.user.baseHourlyWage;
        
        if (tipRate < baseHourlyWage) {
          cost = (baseHourlyWage - tipRate) * hours; // Manager pays the difference
        }
      } else {
        cost = hours * assignment.user.hourlyWage;
      }
      
      totalEmployeeCost += cost;
      totalCardTips += assignment.tipsEarned || 0;
      totalCashTips += assignment.cashTips || 0;
      employeeIds.add(assignment.user.id);
    }

    // Add cook payroll costs
    const totalCookHours = cookPayroll.reduce((sum, c) => sum + c.totalHours, 0);
    const totalCookCost = cookPayroll.reduce((sum, c) => sum + c.totalEarnings, 0);
    
    // Add unique cook employees to count
    cookPayroll.forEach(c => employeeIds.add(c.user.id));

    // Total employee costs
    const totalHoursWithCooks = totalHours + totalCookHours;
    const totalCostWithCooks = totalEmployeeCost + totalCookCost;

    // Monthly expenses
    const foodCosts = monthlyExpenses?.foodCosts || 0;
    const extrasCosts = monthlyExpenses?.extras || 0;

    // Total costs (employee + food + extras)
    const totalCosts = totalCostWithCooks + foodCosts + extrasCosts;

    // Get daily revenues for the month
    const dailyRevenues = await this.prisma.dailyRevenue.findMany({
      where: {
        organizationId,
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    const totalRevenue = dailyRevenues.reduce((sum, r) => sum + r.totalRevenue, 0);
    const profit = totalRevenue - totalCosts;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      year,
      month,
      summary: {
        totalHours: totalHoursWithCooks,
        employeeCost: totalCostWithCooks,
        foodCosts,
        extrasCosts,
        totalCosts,
        totalRevenue,
        profit,
        profitMargin,
        cardTips: totalCardTips,
        cashTips: totalCashTips,
        totalTips: totalCardTips + totalCashTips,
        employeeCount: employeeIds.size,
        shiftCount: assignments.length,
        waiterHours: totalHours,
        waiterCost: totalEmployeeCost,
        cookHours: totalCookHours,
        cookCost: totalCookCost,
      },
      expenses: {
        foodCosts,
        extrasCosts,
        notes: monthlyExpenses?.notes,
      },
    };
  }

  /**
   * Get employee monthly cash tips
   */
  async getEmployeeMonthlyCashTips(
    userId: string,
    organizationId: string,
    year: number,
    month: number,
  ) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // Verify user belongs to organization
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        userId,
        schedule: { organizationId },
        shiftDate: {
          gte: startDate,
          lt: endDate,
        },
        status: { not: 'CANCELLED' },
      },
      select: {
        cashTips: true,
        tipsEarned: true,
        shiftDate: true,
      },
    });

    const totalCashTips = assignments.reduce((sum, a) => sum + (a.cashTips || 0), 0);
    const totalCardTips = assignments.reduce((sum, a) => sum + (a.tipsEarned || 0), 0);

    return {
      userId,
      year,
      month,
      totalCashTips,
      totalCardTips,
      totalTips: totalCashTips + totalCardTips,
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

  /**
   * Get kitchen staff monthly summary (total hours and earnings)
   */
  async getKitchenMonthlySummary(userId: string, organizationId: string, year: number, month: number) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    // Get all cook payroll records for this month
    const cookPayroll = await this.prisma.cookWeeklyHours.findMany({
      where: {
        userId,
        organizationId,
        weekStart: {
          gte: monthStart,
          lt: monthEnd,
        },
      },
    });

    const totalHours = cookPayroll.reduce((sum, record) => sum + record.totalHours, 0);
    const totalEarnings = cookPayroll.reduce((sum, record) => sum + record.totalEarnings, 0);

    return {
      year,
      month,
      totalHours: Math.round(totalHours * 100) / 100,
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      weeks: cookPayroll.length,
    };
  }

  /**
   * Get kitchen staff recent weeks (last 8 weeks)
   */
  async getKitchenRecentWeeks(userId: string, organizationId: string) {
    const today = new Date();
    const eightWeeksAgo = new Date(today);
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56); // 8 weeks

    const cookPayroll = await this.prisma.cookWeeklyHours.findMany({
      where: {
        userId,
        organizationId,
        weekStart: {
          gte: eightWeeksAgo,
        },
      },
      orderBy: {
        weekStart: 'desc',
      },
      take: 8,
    });

    return cookPayroll.map(record => ({
      weekStart: record.weekStart,
      totalHours: Math.round(record.totalHours * 100) / 100,
      totalEarnings: Math.round(record.totalEarnings * 100) / 100,
      hourlyWage: record.hourlyWage,
      notes: record.notes,
    }));
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
