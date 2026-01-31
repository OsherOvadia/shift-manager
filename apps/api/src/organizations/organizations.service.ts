import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createOrganizationDto: CreateOrganizationDto) {
    const { name, adminEmail, adminPassword, adminFirstName, adminLastName } = createOrganizationDto;

    // Check if organization name already exists
    const existingOrg = await this.prisma.organization.findUnique({
      where: { name },
    });

    if (existingOrg) {
      throw new ConflictException('שם הארגון כבר קיים במערכת');
    }

    // Create organization with admin user and default settings
    const isPostgres = process.env.DATABASE_URL?.includes('postgres');
    
    const organization = await this.prisma.organization.create({
      data: {
        name,
        businessSettings: {
          create: {
            weekendDays: isPostgres ? [4, 5, 6] : '4,5,6', // Thursday, Friday, Saturday
            submissionDeadlineDay: 3, // Wednesday
            submissionDeadlineHour: 18,
          } as any,
        },
        users: {
          create: {
            email: adminEmail,
            passwordHash: await bcrypt.hash(adminPassword, 12),
            firstName: adminFirstName,
            lastName: adminLastName,
            role: 'ADMIN' as any,
            employmentType: 'FULL_TIME' as any,
            isApproved: true, // Admin is auto-approved
          },
        },
        shiftTemplates: {
          createMany: {
            data: [
              {
                name: 'משמרת בוקר',
                shiftType: 'MORNING' as any,
                startTime: '11:00',
                endTime: '18:00',
                minStaff: 2,
                maxStaff: 5,
              },
              {
                name: 'משמרת ערב',
                shiftType: 'EVENING' as any,
                startTime: '18:00',
                endTime: '22:00',
                minStaff: 2,
                maxStaff: 5,
              },
              {
                name: 'משמרת סגירה',
                shiftType: 'EVENING_CLOSE' as any,
                startTime: '18:00',
                endTime: '00:00',
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
