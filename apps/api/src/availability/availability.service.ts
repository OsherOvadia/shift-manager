import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

// Work rules configuration
const WORK_RULES: Record<string, { minShifts: number; minWeekendShifts: number }> = {
  FULL_TIME: { minShifts: 5, minWeekendShifts: 2 },
  PART_TIME: { minShifts: 3, minWeekendShifts: 1 },
};

// Helper to parse weekend days from string
function parseWeekendDays(weekendDaysStr: string | null): number[] {
  if (!weekendDaysStr) return [5, 6];
  return weekendDaysStr.split(',').map(d => parseInt(d.trim(), 10));
}

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getWeekAvailability(userId: string, weekStartDate: Date) {
    const startDate = this.normalizeToWeekStart(weekStartDate);

    const submission = await this.prisma.availabilitySubmission.findUnique({
      where: {
        userId_weekStartDate: {
          userId,
          weekStartDate: startDate,
        },
      },
      include: {
        slots: {
          orderBy: [{ shiftDate: 'asc' }, { shiftType: 'asc' }],
        },
      },
    });

    return submission;
  }

  async submitAvailability(userId: string, createDto: CreateAvailabilityDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          include: { businessSettings: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('משתמש לא נמצא');
    }

    const weekStartDate = this.normalizeToWeekStart(new Date(createDto.weekStartDate));

    // Validate against work rules
    const weekendDays = parseWeekendDays(user.organization.businessSettings?.weekendDays || '5,6');
    const validation = this.validateSubmission(createDto.slots, user.employmentType, weekendDays);

    if (!validation.valid) {
      throw new BadRequestException({
        message: 'הזמינות אינה עומדת בדרישות',
        violations: validation.violations,
      });
    }

    // Check if submission already exists
    const existingSubmission = await this.prisma.availabilitySubmission.findUnique({
      where: {
        userId_weekStartDate: {
          userId,
          weekStartDate,
        },
      },
    });

    if (existingSubmission) {
      // Update existing submission
      await this.prisma.availabilitySlot.deleteMany({
        where: { submissionId: existingSubmission.id },
      });

      const updatedSubmission = await this.prisma.availabilitySubmission.update({
        where: { id: existingSubmission.id },
        data: {
          status: 'PENDING',
          submittedAt: new Date(),
          slots: {
            createMany: {
              data: createDto.slots.map((slot) => ({
                shiftDate: new Date(slot.shiftDate),
                shiftType: slot.shiftType,
                preferenceRank: slot.preferenceRank || 1,
              })),
            },
          },
        },
        include: { slots: true },
      });

      return {
        message: 'הזמינות עודכנה בהצלחה',
        submission: updatedSubmission,
      };
    }

    // Create new submission
    const newSubmission = await this.prisma.availabilitySubmission.create({
      data: {
        userId,
        weekStartDate,
        status: 'PENDING',
        submittedAt: new Date(),
        slots: {
          createMany: {
            data: createDto.slots.map((slot) => ({
              shiftDate: new Date(slot.shiftDate),
              shiftType: slot.shiftType,
              preferenceRank: slot.preferenceRank || 1,
            })),
          },
        },
      },
      include: { slots: true },
    });

    return {
      message: 'הזמינות נשלחה בהצלחה',
      submission: newSubmission,
    };
  }

  async updateSubmission(id: string, userId: string, updateDto: UpdateAvailabilityDto) {
    const submission = await this.prisma.availabilitySubmission.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!submission) {
      throw new NotFoundException('הגשת הזמינות לא נמצאה');
    }

    if (submission.userId !== userId) {
      throw new ForbiddenException('אין לך הרשאה לעדכן הגשה זו');
    }

    // Only allow updates if not yet approved
    if (submission.status === 'APPROVED') {
      throw new BadRequestException('לא ניתן לעדכן הגשה שאושרה');
    }

    // Re-validate if slots are being updated
    if (updateDto.slots) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          organization: {
            include: { businessSettings: true },
          },
        },
      });

      const weekendDays = parseWeekendDays(user!.organization.businessSettings?.weekendDays || '5,6');
      const validation = this.validateSubmission(
        updateDto.slots,
        user!.employmentType,
        weekendDays,
      );

      if (!validation.valid) {
        throw new BadRequestException({
          message: 'הזמינות אינה עומדת בדרישות',
          violations: validation.violations,
        });
      }

      // Update slots
      await this.prisma.availabilitySlot.deleteMany({
        where: { submissionId: id },
      });

      await this.prisma.availabilitySlot.createMany({
        data: updateDto.slots.map((slot) => ({
          submissionId: id,
          shiftDate: new Date(slot.shiftDate),
          shiftType: slot.shiftType,
          preferenceRank: slot.preferenceRank || 1,
        })),
      });
    }

    const updatedSubmission = await this.prisma.availabilitySubmission.update({
      where: { id },
      data: {
        status: 'PENDING',
        submittedAt: new Date(),
      },
      include: { slots: true },
    });

    return {
      message: 'הזמינות עודכנה בהצלחה',
      submission: updatedSubmission,
    };
  }

  async getSubmissionDeadline(organizationId: string) {
    const settings = await this.prisma.businessSettings.findUnique({
      where: { organizationId },
    });

    return {
      day: settings?.submissionDeadlineDay ?? 4,
      hour: settings?.submissionDeadlineHour ?? 18,
    };
  }

  // Manager endpoints

  async getAllSubmissions(organizationId: string, weekStartDate: Date) {
    const startDate = this.normalizeToWeekStart(weekStartDate);

    const submissions = await this.prisma.availabilitySubmission.findMany({
      where: {
        weekStartDate: startDate,
        user: { organizationId },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employmentType: true,
          },
        },
        slots: {
          orderBy: [{ shiftDate: 'asc' }, { shiftType: 'asc' }],
        },
      },
      orderBy: {
        user: { lastName: 'asc' },
      },
    });

    return submissions;
  }

  async updateSubmissionStatus(id: string, status: string, organizationId: string) {
    const submission = await this.prisma.availabilitySubmission.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!submission || submission.user.organizationId !== organizationId) {
      throw new NotFoundException('הגשת הזמינות לא נמצאה');
    }

    const updatedSubmission = await this.prisma.availabilitySubmission.update({
      where: { id },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        slots: true,
      },
    });

    // Send notification to employee
    const notificationType = status === 'APPROVED' ? 'SHIFT_APPROVED' : 'SHIFT_REJECTED';
    const title = status === 'APPROVED' ? 'הזמינות אושרה' : 'הזמינות נדחתה';
    const message = status === 'APPROVED'
      ? 'הזמינות שהגשת לשבוע הקרוב אושרה'
      : 'הזמינות שהגשת לשבוע הקרוב נדחתה. אנא עדכן והגש מחדש.';

    await this.notificationsService.create(submission.userId, title, message, notificationType);

    return updatedSubmission;
  }

  async getMissingSubmissions(organizationId: string, weekStartDate: Date) {
    const startDate = this.normalizeToWeekStart(weekStartDate);

    const allEmployees = await this.prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        role: 'EMPLOYEE',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        employmentType: true,
      },
    });

    const submittedUserIds = await this.prisma.availabilitySubmission.findMany({
      where: {
        weekStartDate: startDate,
        user: { organizationId },
      },
      select: { userId: true },
    });

    const submittedIds = new Set(submittedUserIds.map((s) => s.userId));
    const missingEmployees = allEmployees.filter((e) => !submittedIds.has(e.id));

    return missingEmployees;
  }

  // Helper methods

  private normalizeToWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day; // Sunday as start of week
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private validateSubmission(
    slots: { shiftDate: string; shiftType: string; preferenceRank?: number }[],
    employmentType: string,
    weekendDays: number[],
  ) {
    const rules = WORK_RULES[employmentType];
    const violations: { type: string; message: string }[] = [];

    const totalShifts = slots.length;
    const weekendShifts = slots.filter((slot) => {
      const date = new Date(slot.shiftDate);
      return weekendDays.includes(date.getDay());
    }).length;

    if (totalShifts < rules.minShifts) {
      violations.push({
        type: 'INSUFFICIENT_SHIFTS',
        message: `נדרשות לפחות ${rules.minShifts} משמרות, נבחרו ${totalShifts}`,
      });
    }

    if (weekendShifts < rules.minWeekendShifts) {
      violations.push({
        type: 'INSUFFICIENT_WEEKEND_SHIFTS',
        message: `נדרשות לפחות ${rules.minWeekendShifts} משמרות סוף שבוע, נבחרו ${weekendShifts}`,
      });
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }
}
