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

    // Parse date without timezone conversion
    const shiftDate = this.parseLocalDate(createDto.shiftDate);

    // Check for conflicts
    const conflict = await this.checkConflict(
      createDto.userId,
      createDto.scheduleId,
      shiftDate,
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
        shiftDate: shiftDate,
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
        shiftDate: shiftDate,
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
    console.log('=== Assignment Update ===');
    console.log('ID:', id);
    console.log('Received DTO:', JSON.stringify(updateDto, null, 2));
    
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
    
    // Always set numeric fields if they are provided (including 0)
    if (typeof updateDto.tipsEarned === 'number') {
      updateData.tipsEarned = updateDto.tipsEarned;
    }
    if (typeof updateDto.sittingTips === 'number') {
      updateData.sittingTips = updateDto.sittingTips;
    }
    if (typeof updateDto.takeawayTips === 'number') {
      updateData.takeawayTips = updateDto.takeawayTips;
    }
    if (typeof updateDto.deliveryTips === 'number') {
      updateData.deliveryTips = updateDto.deliveryTips;
    }

    console.log('Update data to save:', JSON.stringify(updateData, null, 2));
    console.log('UpdateDto values:', {
      tipsEarned: updateDto.tipsEarned,
      sittingTips: updateDto.sittingTips,
      takeawayTips: updateDto.takeawayTips,
      deliveryTips: updateDto.deliveryTips,
      typeOfSitting: typeof updateDto.sittingTips,
    });

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

    // Verify what was saved by re-reading
    const verifyAssignment = await this.prisma.shiftAssignment.findUnique({
      where: { id },
      select: {
        sittingTips: true,
        takeawayTips: true,
        deliveryTips: true,
        tipsEarned: true,
      },
    });
    console.log('Verified saved data:', JSON.stringify(verifyAssignment, null, 2));

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

  /**
   * Parse date string as local date without timezone conversion
   * Handles both YYYY-MM-DD and ISO format strings
   */
  private parseLocalDate(dateStr: string): Date {
    // If it's already an ISO string with time, extract just the date part
    const datePart = dateStr.split('T')[0];
    
    // Parse as local date: YYYY-MM-DD
    const [year, month, day] = datePart.split('-').map(Number);
    
    // Create date in local timezone (month is 0-indexed in JavaScript)
    return new Date(year, month - 1, day);
  }
}
