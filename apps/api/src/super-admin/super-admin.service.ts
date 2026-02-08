import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuperAdminService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all organizations with stats
   */
  async getAllOrganizations() {
    const organizations = await this.prisma.organization.findMany({
      include: {
        _count: {
          select: {
            users: true,
            weeklySchedules: true,
            shiftTemplates: true,
          },
        },
        businessSettings: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return organizations.map((org) => ({
      id: org.id,
      name: org.name,
      status: org.status,
      contactEmail: org.contactEmail,
      contactPhone: org.contactPhone,
      timezone: org.timezone,
      createdAt: org.createdAt,
      approvedAt: org.approvedAt,
      approvedBy: org.approvedBy,
      userCount: org._count.users,
      scheduleCount: org._count.weeklySchedules,
      shiftTemplateCount: org._count.shiftTemplates,
      hasSettings: !!org.businessSettings,
    }));
  }

  /**
   * Get pending organizations awaiting approval
   */
  async getPendingOrganizations() {
    return this.prisma.organization.findMany({
      where: {
        status: 'PENDING',
      },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Approve an organization
   */
  async approveOrganization(organizationId: string, superAdminId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    if (org.status === 'APPROVED') {
      throw new ForbiddenException('Organization is already approved');
    }

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: superAdminId,
      },
    });
  }

  /**
   * Reject an organization
   */
  async rejectOrganization(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: 'REJECTED',
      },
    });
  }

  /**
   * Suspend an organization
   */
  async suspendOrganization(organizationId: string, superAdminId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: 'SUSPENDED',
        approvedBy: superAdminId, // Track who suspended it
      },
    });
  }

  /**
   * Reactivate a suspended organization
   */
  async reactivateOrganization(organizationId: string, superAdminId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: superAdminId,
      },
    });
  }

  /**
   * Get organization details with full stats
   */
  async getOrganizationDetails(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
        businessSettings: true,
        _count: {
          select: {
            users: true,
            weeklySchedules: true,
            shiftTemplates: true,
            jobCategories: true,
            monthlyExpenses: true,
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  /**
   * Get platform statistics
   */
  async getPlatformStats() {
    const [
      totalOrganizations,
      pendingOrganizations,
      approvedOrganizations,
      suspendedOrganizations,
      totalUsers,
      totalSchedules,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.organization.count({ where: { status: 'PENDING' } }),
      this.prisma.organization.count({ where: { status: 'APPROVED' } }),
      this.prisma.organization.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.user.count({ where: { role: { not: 'SUPER_ADMIN' } } }),
      this.prisma.weeklySchedule.count(),
    ]);

    return {
      totalOrganizations,
      pendingOrganizations,
      approvedOrganizations,
      suspendedOrganizations,
      totalUsers,
      totalSchedules,
    };
  }

  /**
   * Update organization details
   */
  async updateOrganization(
    organizationId: string,
    data: {
      name?: string;
      contactEmail?: string;
      contactPhone?: string;
      timezone?: string;
    },
  ) {
    return this.prisma.organization.update({
      where: { id: organizationId },
      data,
    });
  }

  /**
   * Delete organization (use with caution!)
   */
  async deleteOrganization(organizationId: string) {
    // This will cascade delete all related data
    return this.prisma.organization.delete({
      where: { id: organizationId },
    });
  }
}
