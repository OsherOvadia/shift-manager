import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    const users = await this.prisma.user.findMany({
      where: { organizationId, isApproved: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        employmentType: true,
        hourlyWage: true,
        isActive: true,
        isApproved: true,
        createdAt: true,
        jobCategory: {
          select: {
            id: true,
            name: true,
            nameHe: true,
            color: true,
          },
        },
      },
      orderBy: { lastName: 'asc' },
    });

    return users;
  }

  async findPendingUsers(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId, isApproved: false },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        jobCategory: {
          select: {
            id: true,
            name: true,
            nameHe: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async approveUser(id: string, organizationId: string, data?: { jobCategoryId?: string; hourlyWage?: number; employmentType?: string }) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId },
    });

    if (!user) {
      throw new NotFoundException('המשתמש לא נמצא');
    }

    const updateData: any = {
      isApproved: true,
    };
    if (data?.jobCategoryId) updateData.jobCategoryId = data.jobCategoryId;
    if (data?.hourlyWage !== undefined) updateData.hourlyWage = data.hourlyWage;
    if (data?.employmentType) updateData.employmentType = data.employmentType as any;

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        employmentType: true,
        isApproved: true,
      },
    });
  }

  async rejectUser(id: string, organizationId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId, isApproved: false },
    });

    if (!user) {
      throw new NotFoundException('המשתמש לא נמצא');
    }

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'הבקשה נדחתה והמשתמש נמחק' };
  }

  async findOne(id: string, organizationId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        employmentType: true,
        hourlyWage: true,
        isActive: true,
        isApproved: true,
        createdAt: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
        jobCategory: {
          select: {
            id: true,
            name: true,
            nameHe: true,
            color: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('המשתמש לא נמצא');
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto, requesterId: string, requesterRole: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('המשתמש לא נמצא');
    }

    // Only admins and managers can update other users
    if (id !== requesterId && requesterRole === 'EMPLOYEE') {
      throw new ForbiddenException('אין לך הרשאה לעדכן משתמש זה');
    }

    // Build update data object
    const updateData: any = {};
    if (updateUserDto.firstName !== undefined) updateData.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName !== undefined) updateData.lastName = updateUserDto.lastName;
    if (updateUserDto.jobCategoryId !== undefined) updateData.jobCategoryId = updateUserDto.jobCategoryId;
    if (updateUserDto.hourlyWage !== undefined) updateData.hourlyWage = updateUserDto.hourlyWage;

    // Employees can only update their own non-sensitive fields
    if (requesterRole !== 'EMPLOYEE') {
      if (updateUserDto.role !== undefined) updateData.role = updateUserDto.role as any;
      if (updateUserDto.employmentType !== undefined) updateData.employmentType = updateUserDto.employmentType as any;
      if (updateUserDto.isActive !== undefined) updateData.isActive = updateUserDto.isActive;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        employmentType: true,
        hourlyWage: true,
        isActive: true,
        createdAt: true,
        jobCategory: {
          select: {
            id: true,
            name: true,
            nameHe: true,
            color: true,
          },
        },
      },
    });

    return updatedUser;
  }

  async deactivate(id: string, requesterId: string, requesterRole: string, organizationId: string) {
    if (requesterRole !== 'ADMIN' && requesterRole !== 'MANAGER') {
      throw new ForbiddenException('אין לך הרשאה לבטל משתמש');
    }

    const user = await this.prisma.user.findFirst({
      where: { id, organizationId },
    });

    if (!user) {
      throw new NotFoundException('המשתמש לא נמצא');
    }

    if (id === requesterId) {
      throw new ForbiddenException('לא ניתן לבטל את עצמך');
    }

    // Hard delete the user from the database
    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'המשתמש נמחק בהצלחה' };
  }

  async getActiveEmployees(organizationId: string) {
    return this.prisma.user.findMany({
      where: {
        organizationId,
        isActive: true,
        isApproved: true,
        role: 'EMPLOYEE',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        employmentType: true,
        hourlyWage: true,
        isActive: true,
        isApproved: true,
        jobCategory: {
          select: {
            id: true,
            name: true,
            nameHe: true,
            color: true,
          },
        },
      },
      orderBy: { lastName: 'asc' },
    });
  }
}
