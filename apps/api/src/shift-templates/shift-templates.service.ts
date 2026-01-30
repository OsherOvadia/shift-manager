import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';

@Injectable()
export class ShiftTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.shiftTemplate.findMany({
      where: { organizationId },
      orderBy: [{ shiftType: 'asc' }, { name: 'asc' }],
    });
  }

  async findActive(organizationId: string) {
    return this.prisma.shiftTemplate.findMany({
      where: { organizationId, isActive: true },
      orderBy: [{ shiftType: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, organizationId: string) {
    const template = await this.prisma.shiftTemplate.findFirst({
      where: { id, organizationId },
    });

    if (!template) {
      throw new NotFoundException('תבנית המשמרת לא נמצאה');
    }

    return template;
  }

  async create(createDto: CreateShiftTemplateDto, organizationId: string) {
    return this.prisma.shiftTemplate.create({
      data: {
        ...createDto,
        organizationId,
      },
    });
  }

  async update(id: string, updateDto: UpdateShiftTemplateDto, organizationId: string) {
    await this.findOne(id, organizationId);

    return this.prisma.shiftTemplate.update({
      where: { id },
      data: updateDto,
    });
  }

  async deactivate(id: string, organizationId: string) {
    await this.findOne(id, organizationId);

    return this.prisma.shiftTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
