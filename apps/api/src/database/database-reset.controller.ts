import { Controller, Post, Body, UseGuards, Request, UnauthorizedException, InternalServerErrorException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Only this email can perform organization resets
const SUPER_ADMIN_EMAIL = 'oser130309@gmail.com';

@Controller('database-reset')
export class DatabaseResetController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reset all data for a specific organization while keeping:
   * - The table structure (no schema changes)
   * - MANAGER and ADMIN accounts
   * 
   * Only the super admin (oser130309@gmail.com) can perform this action.
   */
  @Post('reset-organization')
  @UseGuards(JwtAuthGuard)
  async resetOrganization(
    @Request() req: any,
    @Body() body: { organizationName: string },
  ) {
    // Verify the requesting user is the super admin
    const userId = req.user?.sub || req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Authentication required');
    }

    const requestingUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true },
    });

    if (!requestingUser || requestingUser.email !== SUPER_ADMIN_EMAIL) {
      throw new ForbiddenException('Only the super admin can reset organizations');
    }

    if (!body.organizationName || !body.organizationName.trim()) {
      throw new NotFoundException('Organization name is required');
    }

    const orgName = body.organizationName.trim();

    try {
      // Find the organization by name (supports names with spaces)
      const organization = await this.prisma.organization.findFirst({
        where: { name: orgName },
      });

      if (!organization) {
        throw new NotFoundException(`Organization "${orgName}" not found`);
      }

      const orgId = organization.id;

      // Find manager/admin user IDs to preserve
      const managersToKeep = await this.prisma.user.findMany({
        where: {
          organizationId: orgId,
          role: { in: ['ADMIN', 'MANAGER'] as any },
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
      });

      const managerIds = managersToKeep.map(m => m.id);

      // Find all employee user IDs (to delete)
      const employeesToDelete = await this.prisma.user.findMany({
        where: {
          organizationId: orgId,
          role: { notIn: ['ADMIN', 'MANAGER'] as any },
        },
        select: { id: true },
      });
      const employeeIds = employeesToDelete.map(e => e.id);

      // All user IDs in this org (for cascading deletes)
      const allUserIds = [...managerIds, ...employeeIds];

      // ============ DELETE DATA IN CORRECT ORDER (respecting FK constraints) ============

      // 1. Delete refresh tokens for all users (including managers - they'll re-login)
      await this.prisma.refreshToken.deleteMany({
        where: { userId: { in: allUserIds } },
      });

      // 2. Delete notifications for all users
      await this.prisma.notification.deleteMany({
        where: { userId: { in: allUserIds } },
      });

      // 3. Delete all shift assignments in this org's schedules
      const schedules = await this.prisma.weeklySchedule.findMany({
        where: { organizationId: orgId },
        select: { id: true },
      });
      const scheduleIds = schedules.map(s => s.id);

      if (scheduleIds.length > 0) {
        await this.prisma.shiftAssignment.deleteMany({
          where: { scheduleId: { in: scheduleIds } },
        });
      }

      // 4. Delete availability slots for all users
      const submissions = await this.prisma.availabilitySubmission.findMany({
        where: { userId: { in: allUserIds } },
        select: { id: true },
      });
      const submissionIds = submissions.map(s => s.id);

      if (submissionIds.length > 0) {
        await this.prisma.availabilitySlot.deleteMany({
          where: { submissionId: { in: submissionIds } },
        });
      }

      // 5. Delete availability submissions
      await this.prisma.availabilitySubmission.deleteMany({
        where: { userId: { in: allUserIds } },
      });

      // 6. Delete cook weekly hours
      await this.prisma.cookWeeklyHours.deleteMany({
        where: { organizationId: orgId },
      });

      // 7. Delete monthly expenses
      await this.prisma.monthlyExpenses.deleteMany({
        where: { organizationId: orgId },
      });

      // 8. Delete daily revenues
      await this.prisma.dailyRevenue.deleteMany({
        where: { organizationId: orgId },
      });

      // 9. Delete weekly schedules
      await this.prisma.weeklySchedule.deleteMany({
        where: { organizationId: orgId },
      });

      // 10. Delete shift templates
      await this.prisma.shiftTemplate.deleteMany({
        where: { organizationId: orgId },
      });

      // 11. Delete employee users (NOT managers/admins)
      if (employeeIds.length > 0) {
        await this.prisma.user.deleteMany({
          where: { id: { in: employeeIds } },
        });
      }

      // 12. Delete job categories
      // First, unset jobCategoryId on preserved managers
      await this.prisma.user.updateMany({
        where: { id: { in: managerIds }, jobCategoryId: { not: null } },
        data: { jobCategoryId: null },
      });
      await this.prisma.jobCategory.deleteMany({
        where: { organizationId: orgId },
      });

      // 13. Delete business settings
      await this.prisma.businessSettings.deleteMany({
        where: { organizationId: orgId },
      });

      return {
        success: true,
        message: `Organization "${orgName}" has been reset successfully.`,
        preserved: {
          organization: { id: orgId, name: orgName },
          managers: managersToKeep.map(m => ({
            id: m.id,
            email: m.email,
            name: `${m.firstName} ${m.lastName}`,
            role: m.role,
          })),
        },
        deleted: {
          employees: employeeIds.length,
          schedules: scheduleIds.length,
          notifications: 'all',
          revenues: 'all',
          expenses: 'all',
          shiftTemplates: 'all',
          jobCategories: 'all',
          settings: 'all',
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Failed to reset organization',
        error: error.message,
      });
    }
  }
}
