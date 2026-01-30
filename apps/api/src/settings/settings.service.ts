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

    if (!settings) {
      // Create default settings if not exist
      const created = await this.prisma.businessSettings.create({
        data: {
          organizationId,
          weekendDays: '5,6',
          submissionDeadlineDay: 4,
          submissionDeadlineHour: 18,
        },
      });
      // Return with parsed weekendDays for API response
      return {
        ...created,
        weekendDays: created.weekendDays.split(',').map(d => parseInt(d, 10)),
      };
    }

    // Return with parsed weekendDays for API response
    return {
      ...settings,
      weekendDays: settings.weekendDays.split(',').map(d => parseInt(d, 10)),
    };
  }

  async update(organizationId: string, updateDto: UpdateSettingsDto) {
    const settings = await this.prisma.businessSettings.findUnique({
      where: { organizationId },
    });

    // Convert weekendDays array to comma-separated string for storage
    const dataToSave: any = { ...updateDto };
    if (updateDto.weekendDays) {
      dataToSave.weekendDays = updateDto.weekendDays.join(',');
    }

    if (!settings) {
      // Create with provided values
      const created = await this.prisma.businessSettings.create({
        data: {
          organizationId,
          weekendDays: dataToSave.weekendDays || '5,6',
          submissionDeadlineDay: dataToSave.submissionDeadlineDay || 4,
          submissionDeadlineHour: dataToSave.submissionDeadlineHour || 18,
        },
      });
      return {
        ...created,
        weekendDays: created.weekendDays.split(',').map(d => parseInt(d, 10)),
      };
    }

    const updated = await this.prisma.businessSettings.update({
      where: { organizationId },
      data: dataToSave,
    });

    return {
      ...updated,
      weekendDays: updated.weekendDays.split(',').map(d => parseInt(d, 10)),
    };
  }
}
