import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(organizationId: string) {
    const settings = await this.prisma.businessSettings.findUnique({
      where: { organizationId },
    });

    // Check if we're using PostgreSQL (array) or SQLite (string)
    const isPostgres = process.env.DATABASE_URL?.includes('postgres');

    if (!settings) {
      // Create default settings if not exist
      const created = await this.prisma.businessSettings.create({
        data: {
          organizationId,
          weekendDays: isPostgres ? [4, 5, 6] : '4,5,6',
          submissionDeadlineDay: 3,
          submissionDeadlineHour: 18,
          closedPeriods: [],
        } as any,
      });
      // Return with parsed weekendDays for API response
      return {
        ...created,
        weekendDays: Array.isArray(created.weekendDays) 
          ? created.weekendDays 
          : (created.weekendDays as any).split(',').map((d: string) => parseInt(d, 10)),
        closedPeriods: (created as any).closedPeriods || [],
      };
    }

    // Return with parsed weekendDays and closedPeriods for API response
    return {
      ...settings,
      weekendDays: Array.isArray(settings.weekendDays) 
        ? settings.weekendDays 
        : (settings.weekendDays as any).split(',').map((d: string) => parseInt(d, 10)),
      closedPeriods: (settings as any).closedPeriods || [],
    };
  }

  async update(organizationId: string, updateDto: UpdateSettingsDto) {
    const settings = await this.prisma.businessSettings.findUnique({
      where: { organizationId },
    });

    // Build update data - convert weekendDays array if provided
    const dataToSave: any = {};
    
    // Check if we're using PostgreSQL (array) or SQLite (string)
    const isPostgres = process.env.DATABASE_URL?.includes('postgres');
    
    if (updateDto.weekendDays !== undefined) {
      dataToSave.weekendDays = isPostgres ? updateDto.weekendDays : updateDto.weekendDays.join(',');
    }
    if (updateDto.submissionDeadlineDay !== undefined) {
      dataToSave.submissionDeadlineDay = updateDto.submissionDeadlineDay;
    }
    if (updateDto.submissionDeadlineHour !== undefined) {
      dataToSave.submissionDeadlineHour = updateDto.submissionDeadlineHour;
    }
    if (updateDto.closedPeriods !== undefined) {
      dataToSave.closedPeriods = updateDto.closedPeriods;
    }
    if (updateDto.defaultHourlyWage !== undefined) {
      dataToSave.defaultHourlyWage = updateDto.defaultHourlyWage;
    }
    if (updateDto.defaultWages !== undefined) {
      dataToSave.defaultWages = updateDto.defaultWages;
    }

    if (!settings) {
      // Create with provided values
      const created = await this.prisma.businessSettings.create({
        data: {
          organizationId,
          weekendDays: dataToSave.weekendDays || (isPostgres ? [4, 5, 6] : '4,5,6'),
          submissionDeadlineDay: dataToSave.submissionDeadlineDay || 3,
          submissionDeadlineHour: dataToSave.submissionDeadlineHour || 18,
          closedPeriods: dataToSave.closedPeriods || [],
        } as any,
      });
      return {
        ...created,
        weekendDays: Array.isArray(created.weekendDays) 
          ? created.weekendDays 
          : (created.weekendDays as any).split(',').map((d: string) => parseInt(d, 10)),
        closedPeriods: (created as any).closedPeriods || [],
      };
    }

    const updated = await this.prisma.businessSettings.update({
      where: { organizationId },
      data: dataToSave,
    });

    return {
      ...updated,
      weekendDays: Array.isArray(updated.weekendDays) 
        ? updated.weekendDays 
        : (updated.weekendDays as any).split(',').map((d: string) => parseInt(d, 10)),
      closedPeriods: (updated as any).closedPeriods || [],
    };
  }
}
