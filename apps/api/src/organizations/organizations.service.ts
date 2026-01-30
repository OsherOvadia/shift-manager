import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    const { name, adminEmail, adminPassword, adminFirstName, adminLastName } = createOrganizationDto;

    // Create organization with admin user and default settings
    const organization = await this.prisma.organization.create({
      data: {
        name,
        businessSettings: {
          create: {
            weekendDays: '5,6', // Friday, Saturday (comma-separated for SQLite)
            submissionDeadlineDay: 4, // Thursday
            submissionDeadlineHour: 18,
          },
        },
        users: {
          create: {
            email: adminEmail,
            passwordHash: await bcrypt.hash(adminPassword, 12),
            firstName: adminFirstName,
            lastName: adminLastName,
            role: 'ADMIN',
            employmentType: 'FULL_TIME',
            isApproved: true, // Admin is auto-approved
          },
        },
        shiftTemplates: {
          createMany: {
            data: [
              {
                name: 'משמרת בוקר',
                shiftType: 'MORNING',
                startTime: '07:00',
                endTime: '15:00',
                minStaff: 2,
                maxStaff: 5,
              },
              {
                name: 'משמרת ערב',
                shiftType: 'EVENING',
                startTime: '15:00',
                endTime: '23:00',
                minStaff: 2,
                maxStaff: 5,
              },
              {
                name: 'משמרת ערב + סגירה',
                shiftType: 'EVENING_CLOSE',
                startTime: '15:00',
                endTime: '01:00',
                minStaff: 1,
                maxStaff: 3,
              },
            ],
          },
        },
        jobCategories: {
          createMany: {
            data: [
              { name: 'waiter', nameHe: 'מלצר', color: '#3b82f6' },
              { name: 'cook', nameHe: 'טבח', color: '#ef4444' },
              { name: 'sushiman', nameHe: 'סושימן', color: '#10b981' },
              { name: 'bartender', nameHe: 'ברמן', color: '#f59e0b' },
              { name: 'host', nameHe: 'מארח', color: '#8b5cf6' },
              { name: 'dishwasher', nameHe: 'שוטף כלים', color: '#6b7280' },
            ],
          },
        },
      },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        businessSettings: true,
        jobCategories: true,
      },
    });

    return organization;
  }

  async findOne(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        businessSettings: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('הארגון לא נמצא');
    }

    return organization;
  }

  async update(id: string, name: string) {
    const organization = await this.prisma.organization.update({
      where: { id },
      data: { name },
    });

    return organization;
  }
}
