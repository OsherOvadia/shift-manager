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
        name: createDto.name,
        shiftType: createDto.shiftType,
        startTime: createDto.startTime,
        endTime: createDto.endTime,
        minStaff: createDto.minStaff,
        maxStaff: createDto.maxStaff,
        organizationId,
      },
    });
  }

  async update(id: string, updateDto: UpdateShiftTemplateDto, organizationId: string) {
    await this.findOne(id, organizationId);

    const updateData: any = {};
    if (updateDto.name !== undefined) updateData.name = updateDto.name;
    if (updateDto.shiftType !== undefined) updateData.shiftType = updateDto.shiftType;
    if (updateDto.startTime !== undefined) updateData.startTime = updateDto.startTime;
    if (updateDto.endTime !== undefined) updateData.endTime = updateDto.endTime;
    if (updateDto.minStaff !== undefined) updateData.minStaff = updateDto.minStaff;
    if (updateDto.maxStaff !== undefined) updateData.maxStaff = updateDto.maxStaff;
    if (updateDto.isActive !== undefined) updateData.isActive = updateDto.isActive;

    return this.prisma.shiftTemplate.update({
      where: { id },
      data: updateData,
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
