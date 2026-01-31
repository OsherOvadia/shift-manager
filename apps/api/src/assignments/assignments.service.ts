import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { BulkAssignmentDto } from './dto/bulk-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(createDto: CreateAssignmentDto, organizationId: string) {
    // Verify schedule exists and belongs to organization
    const schedule = await this.prisma.weeklySchedule.findFirst({
      where: { id: createDto.scheduleId, organizationId },
    });

    if (!schedule) {
      throw new NotFoundException('לוח המשמרות לא נמצא');
    }

    if (schedule.status === 'PUBLISHED') {
      throw new BadRequestException('לא ניתן להוסיף משמרות ללוח שפורסם');
    }

    // Verify user exists and belongs to organization
    const user = await this.prisma.user.findFirst({
      where: { id: createDto.userId, organizationId },
    });

    if (!user) {
      throw new NotFoundException('העובד לא נמצא');
    }

    // Verify shift template exists
    const shiftTemplate = await this.prisma.shiftTemplate.findFirst({
      where: { id: createDto.shiftTemplateId, organizationId },
    });

    if (!shiftTemplate) {
      throw new NotFoundException('תבנית המשמרת לא נמצאה');
    }

    // Check for conflicts
    const conflict = await this.checkConflict(
      createDto.userId,
      createDto.scheduleId,
      new Date(createDto.shiftDate),
      createDto.shiftTemplateId,
    );

    if (conflict) {
      throw new ConflictException('העובד כבר משובץ למשמרת זו');
    }

    // Check staffing limits
    const currentStaff = await this.prisma.shiftAssignment.count({
      where: {
        scheduleId: createDto.scheduleId,
        shiftTemplateId: createDto.shiftTemplateId,
        shiftDate: new Date(createDto.shiftDate),
        status: { not: 'CANCELLED' },
      },
    });

    if (currentStaff >= shiftTemplate.maxStaff) {
      throw new BadRequestException(`המשמרת מלאה (מקסימום ${shiftTemplate.maxStaff} עובדים)`);
    }

    const assignment = await this.prisma.shiftAssignment.create({
      data: {
        scheduleId: createDto.scheduleId,
        userId: createDto.userId,
        shiftTemplateId: createDto.shiftTemplateId,
        shiftDate: new Date(createDto.shiftDate),
        status: 'PENDING',
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        shiftTemplate: true,
      },
    });

    return assignment;
  }

  async update(id: string, updateDto: UpdateAssignmentDto, organizationId: string) {
    const assignment = await this.prisma.shiftAssignment.findFirst({
      where: { id },
      include: {
        schedule: true,
        user: true,
      },
    });

    if (!assignment || assignment.schedule.organizationId !== organizationId) {
      throw new NotFoundException('השיבוץ לא נמצא');
    }

    const updateData: any = {};
    if (updateDto.status !== undefined) updateData.status = updateDto.status as any;
    if (updateDto.tipsEarned !== undefined) updateData.tipsEarned = updateDto.tipsEarned;

    const updatedAssignment = await this.prisma.shiftAssignment.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        shiftTemplate: true,
      },
    });

    // If schedule is published and assignment changed, notify user
    if (assignment.schedule.status === 'PUBLISHED') {
      await this.notificationsService.create(
        assignment.userId,
        'שינוי במשמרת',
        'חל שינוי באחת המשמרות שלך. בדוק את לוח המשמרות.',
        'SHIFT_CHANGED',
      );
    }

    return updatedAssignment;
  }

  async remove(id: string, organizationId: string) {
    const assignment = await this.prisma.shiftAssignment.findFirst({
      where: { id },
      include: {
        schedule: true,
      },
    });

    if (!assignment || assignment.schedule.organizationId !== organizationId) {
      throw new NotFoundException('השיבוץ לא נמצא');
    }

    if (assignment.schedule.status === 'PUBLISHED') {
      throw new BadRequestException('לא ניתן למחוק שיבוץ מלוח שפורסם');
    }

    await this.prisma.shiftAssignment.delete({
      where: { id },
    });

    return { message: 'השיבוץ נמחק בהצלחה' };
  }

  async bulkCreate(bulkDto: BulkAssignmentDto, organizationId: string) {
    const results = {
      created: [] as any[],
      errors: [] as { assignment: any; error: string }[],
    };

    for (const assignment of bulkDto.assignments) {
      try {
        const created = await this.create(
          {
            scheduleId: bulkDto.scheduleId,
            userId: assignment.userId,
            shiftTemplateId: assignment.shiftTemplateId,
            shiftDate: assignment.shiftDate,
          },
          organizationId,
        );
        results.created.push(created);
      } catch (error: any) {
        results.errors.push({
          assignment,
          error: error.message || 'שגיאה לא ידועה',
        });
      }
    }

    return results;
  }

  async checkConflicts(scheduleId: string, organizationId: string) {
    const schedule = await this.prisma.weeklySchedule.findFirst({
      where: { id: scheduleId, organizationId },
      include: {
        shiftAssignments: {
          include: {
            shiftTemplate: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('לוח המשמרות לא נמצא');
    }

    const conflicts: any[] = [];

    // Group assignments by date and shift type
    const groupedByDateAndShift = new Map<string, typeof schedule.shiftAssignments>();

    for (const assignment of schedule.shiftAssignments) {
      const key = `${assignment.shiftDate.toISOString()}_${assignment.shiftTemplateId}`;
      if (!groupedByDateAndShift.has(key)) {
        groupedByDateAndShift.set(key, []);
      }
      groupedByDateAndShift.get(key)!.push(assignment);
    }

    // Check for understaffing
    const shiftTemplates = await this.prisma.shiftTemplate.findMany({
      where: { organizationId, isActive: true },
    });

    for (const [key, assignments] of groupedByDateAndShift) {
      const [dateStr, templateId] = key.split('_');
      const template = shiftTemplates.find((t) => t.id === templateId);

      if (template && assignments.length < template.minStaff) {
        conflicts.push({
          type: 'UNDERSTAFFED',
          date: dateStr,
          shiftTemplate: template,
          current: assignments.length,
          required: template.minStaff,
          message: `משמרת ${template.name} ביום ${new Date(dateStr).toLocaleDateString('he-IL')} - חסרים ${template.minStaff - assignments.length} עובדים`,
        });
      }
    }

    return conflicts;
  }

  private async checkConflict(
    userId: string,
    scheduleId: string,
    shiftDate: Date,
    shiftTemplateId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.shiftAssignment.findUnique({
      where: {
        scheduleId_userId_shiftDate_shiftTemplateId: {
          scheduleId,
          userId,
          shiftDate,
          shiftTemplateId,
        },
      },
    });

    return !!existing;
  }
}
