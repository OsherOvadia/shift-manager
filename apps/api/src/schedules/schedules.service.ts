import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(organizationId: string) {
    return this.prisma.weeklySchedule.findMany({
      where: { organizationId },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: { shiftAssignments: true },
        },
      },
      orderBy: { weekStartDate: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const schedule = await this.prisma.weeklySchedule.findFirst({
      where: { id, organizationId },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        shiftAssignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employmentType: true,
              },
            },
            shiftTemplate: true,
          },
          orderBy: [{ shiftDate: 'asc' }, { shiftTemplate: { shiftType: 'asc' } }],
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('לוח המשמרות לא נמצא');
    }

    return schedule;
  }

  async create(createDto: CreateScheduleDto, userId: string, organizationId: string) {
    const weekStartDate = this.normalizeToWeekStart(new Date(createDto.weekStartDate));

    // Check if schedule already exists for this week
    const existing = await this.prisma.weeklySchedule.findUnique({
      where: {
        organizationId_weekStartDate: {
          organizationId,
          weekStartDate,
        },
      },
    });

    if (existing) {
      throw new ConflictException('לוח משמרות כבר קיים לשבוע זה');
    }

    const schedule = await this.prisma.weeklySchedule.create({
      data: {
        organizationId,
        weekStartDate,
        createdById: userId,
        status: 'DRAFT' as any,
      },
      include: {
        createdBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return schedule;
  }

  async updateStatus(id: string, status: string, organizationId: string) {
    const schedule = await this.prisma.weeklySchedule.findFirst({
      where: { id, organizationId },
    });

    if (!schedule) {
      throw new NotFoundException('לוח המשמרות לא נמצא');
    }

    return this.prisma.weeklySchedule.update({
      where: { id },
      data: { status: status as any },
    });
  }

  async publish(id: string, organizationId: string) {
    const schedule = await this.prisma.weeklySchedule.findFirst({
      where: { id, organizationId },
      include: {
        shiftAssignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('לוח המשמרות לא נמצא');
    }

    if (schedule.status === 'PUBLISHED') {
      throw new BadRequestException('לוח המשמרות כבר פורסם');
    }

    // Validate that there are assignments
    if (schedule.shiftAssignments.length === 0) {
      throw new BadRequestException('לא ניתן לפרסם לוח משמרות ריק');
    }

    // Update schedule status
    const updatedSchedule = await this.prisma.weeklySchedule.update({
      where: { id },
      data: {
        status: 'PUBLISHED' as any,
        publishedAt: new Date(),
      },
    });

    // Get unique user IDs from assignments
    const uniqueUserIds = [...new Set(schedule.shiftAssignments.map((a) => a.user.id))];

    // Send notifications to all assigned employees
    await Promise.all(
      uniqueUserIds.map((userId) =>
        this.notificationsService.create(
          userId,
          'לוח משמרות פורסם',
          'לוח המשמרות לשבוע הקרוב פורסם. בדוק את המשמרות שלך.',
          'SCHEDULE_PUBLISHED',
        ),
      ),
    );

    return {
      message: 'לוח המשמרות פורסם בהצלחה',
      schedule: updatedSchedule,
    };
  }

  async delete(id: string, organizationId: string) {
    const schedule = await this.prisma.weeklySchedule.findFirst({
      where: { id, organizationId },
    });

    if (!schedule) {
      throw new NotFoundException('לוח המשמרות לא נמצא');
    }

    if (schedule.status === 'PUBLISHED') {
      throw new BadRequestException('לא ניתן למחוק לוח משמרות שפורסם');
    }

    await this.prisma.weeklySchedule.delete({
      where: { id },
    });

    return { message: 'לוח המשמרות נמחק בהצלחה' };
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
