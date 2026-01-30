import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobCategoryDto } from './dto/create-job-category.dto';
import { UpdateJobCategoryDto } from './dto/update-job-category.dto';

@Injectable()
export class JobCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.jobCategory.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });
  }

  async findActive(organizationId: string) {
    return this.prisma.jobCategory.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const category = await this.prisma.jobCategory.findFirst({
      where: { id, organizationId },
      include: {
        users: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('קטגוריה לא נמצאה');
    }

    return category;
  }

  async create(createDto: CreateJobCategoryDto, organizationId: string) {
    // Check for duplicate name
    const existing = await this.prisma.jobCategory.findFirst({
      where: { organizationId, name: createDto.name },
    });

    if (existing) {
      throw new ConflictException('קטגוריה עם שם זה כבר קיימת');
    }

    return this.prisma.jobCategory.create({
      data: {
        ...createDto,
        organizationId,
      },
    });
  }

  async update(id: string, updateDto: UpdateJobCategoryDto, organizationId: string) {
    const category = await this.prisma.jobCategory.findFirst({
      where: { id, organizationId },
    });

    if (!category) {
      throw new NotFoundException('קטגוריה לא נמצאה');
    }

    // Check for duplicate name if name is being changed
    if (updateDto.name && updateDto.name !== category.name) {
      const existing = await this.prisma.jobCategory.findFirst({
        where: { organizationId, name: updateDto.name, id: { not: id } },
      });

      if (existing) {
        throw new ConflictException('קטגוריה עם שם זה כבר קיימת');
      }
    }

    return this.prisma.jobCategory.update({
      where: { id },
      data: updateDto,
    });
  }

  async delete(id: string, organizationId: string) {
    const category = await this.prisma.jobCategory.findFirst({
      where: { id, organizationId },
      include: {
        _count: { select: { users: true } },
      },
    });

    if (!category) {
      throw new NotFoundException('קטגוריה לא נמצאה');
    }

    if (category._count.users > 0) {
      // Soft delete if has users
      return this.prisma.jobCategory.update({
        where: { id },
        data: { isActive: false },
      });
    }

    // Hard delete if no users
    await this.prisma.jobCategory.delete({
      where: { id },
    });

    return { message: 'קטגוריה נמחקה בהצלחה' };
  }

  async createDefaultCategories(organizationId: string) {
    const defaultCategories = [
      { name: 'waiter', nameHe: 'מלצר', color: '#3b82f6' },
      { name: 'cook', nameHe: 'טבח', color: '#ef4444' },
      { name: 'sushiman', nameHe: 'סושימן', color: '#10b981' },
      { name: 'bartender', nameHe: 'ברמן', color: '#f59e0b' },
      { name: 'host', nameHe: 'מארח', color: '#8b5cf6' },
      { name: 'dishwasher', nameHe: 'שוטף כלים', color: '#6b7280' },
    ];

    // Create categories one by one, ignoring duplicates
    for (const cat of defaultCategories) {
      try {
        await this.prisma.jobCategory.create({
          data: {
            ...cat,
            organizationId,
          },
        });
      } catch (e) {
        // Ignore duplicate key errors
      }
    }
  }
}
