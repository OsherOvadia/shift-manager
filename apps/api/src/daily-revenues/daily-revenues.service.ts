import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDailyRevenueDto } from './dto/create-daily-revenue.dto';
import { UpdateDailyRevenueDto } from './dto/update-daily-revenue.dto';

@Injectable()
export class DailyRevenuesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateDailyRevenueDto) {
    const date = new Date(dto.date);
    date.setHours(0, 0, 0, 0);

    // Check if revenue entry already exists for this date
    const existing = await this.prisma.dailyRevenue.findUnique({
      where: {
        organizationId_date: {
          organizationId,
          date,
        },
      },
    });

    if (existing) {
      // Update existing entry
      return this.prisma.dailyRevenue.update({
        where: { id: existing.id },
        data: {
          totalRevenue: dto.totalRevenue,
          notes: dto.notes,
        },
      });
    }

    // Create new entry
    return this.prisma.dailyRevenue.create({
      data: {
        organizationId,
        date,
        totalRevenue: dto.totalRevenue,
        notes: dto.notes,
      },
    });
  }

  async findByDateRange(organizationId: string, startDate: Date, endDate: Date) {
    return this.prisma.dailyRevenue.findMany({
      where: {
        organizationId,
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });
  }

  async findOne(organizationId: string, date: Date) {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    return this.prisma.dailyRevenue.findUnique({
      where: {
        organizationId_date: {
          organizationId,
          date: normalizedDate,
        },
      },
    });
  }

  async update(id: string, organizationId: string, dto: UpdateDailyRevenueDto) {
    const revenue = await this.prisma.dailyRevenue.findFirst({
      where: { id, organizationId },
    });

    if (!revenue) {
      throw new NotFoundException('Daily revenue not found');
    }

    const updateData: any = {};
    if (dto.totalRevenue !== undefined) updateData.totalRevenue = dto.totalRevenue;
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    return this.prisma.dailyRevenue.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, organizationId: string) {
    const revenue = await this.prisma.dailyRevenue.findFirst({
      where: { id, organizationId },
    });

    if (!revenue) {
      throw new NotFoundException('Daily revenue not found');
    }

    return this.prisma.dailyRevenue.delete({
      where: { id },
    });
  }
}
