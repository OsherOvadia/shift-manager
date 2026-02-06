import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMonthlyExpensesDto } from './dto/create-monthly-expenses.dto';
import { UpdateMonthlyExpensesDto } from './dto/update-monthly-expenses.dto';

@Injectable()
export class MonthlyExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrUpdate(
    createDto: CreateMonthlyExpensesDto,
    organizationId: string,
  ) {
    // Check if record exists
    const existing = await this.prisma.monthlyExpenses.findUnique({
      where: {
        organizationId_year_month: {
          organizationId,
          year: createDto.year,
          month: createDto.month,
        },
      },
    });

    if (existing) {
      // Update existing record
      return this.prisma.monthlyExpenses.update({
        where: { id: existing.id },
        data: {
          foodCosts: createDto.foodCosts ?? existing.foodCosts,
          extras: createDto.extras ?? existing.extras,
          notes: createDto.notes ?? existing.notes,
        },
      });
    }

    // Create new record
    return this.prisma.monthlyExpenses.create({
      data: {
        organizationId,
        year: createDto.year,
        month: createDto.month,
        foodCosts: createDto.foodCosts ?? 0,
        extras: createDto.extras ?? 0,
        notes: createDto.notes,
      },
    });
  }

  async update(
    id: string,
    updateDto: UpdateMonthlyExpensesDto,
    organizationId: string,
  ) {
    const expense = await this.prisma.monthlyExpenses.findFirst({
      where: { id, organizationId },
    });

    if (!expense) {
      throw new NotFoundException('Monthly expenses record not found');
    }

    return this.prisma.monthlyExpenses.update({
      where: { id },
      data: updateDto,
    });
  }

  async findOne(year: number, month: number, organizationId: string) {
    return this.prisma.monthlyExpenses.findUnique({
      where: {
        organizationId_year_month: {
          organizationId,
          year,
          month,
        },
      },
    });
  }

  async findByYearRange(
    startYear: number,
    startMonth: number,
    endYear: number,
    endMonth: number,
    organizationId: string,
  ) {
    // Get all records and filter in memory for simplicity
    const records = await this.prisma.monthlyExpenses.findMany({
      where: {
        organizationId,
        OR: [
          {
            year: { gte: startYear, lte: endYear },
          },
        ],
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    // Filter by date range
    return records.filter((record) => {
      const recordDate = record.year * 12 + record.month;
      const startDate = startYear * 12 + startMonth;
      const endDate = endYear * 12 + endMonth;
      return recordDate >= startDate && recordDate <= endDate;
    });
  }

  async remove(id: string, organizationId: string) {
    const expense = await this.prisma.monthlyExpenses.findFirst({
      where: { id, organizationId },
    });

    if (!expense) {
      throw new NotFoundException('Monthly expenses record not found');
    }

    return this.prisma.monthlyExpenses.delete({
      where: { id },
    });
  }
}
