import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Check if admin organization already exists
  const existingOrg = await prisma.organization.findFirst({
    where: { name: 'Demo Organization' },
  });

  if (existingOrg) {
    console.log('✅ Seed data already exists. Skipping...');
    console.log('');
    console.log('📧 Login Credentials:');
    console.log('   Admin - admin@demo.com / admin123');
    console.log('   Worker - worker@demo.com / worker123');
    return;
  }

  // Create demo organization
  const organization = await prisma.organization.create({
    data: {
      name: 'Demo Organization',
      businessSettings: {
        create: {
          weekendDays: process.env.DATABASE_URL?.includes('neon') ? [4, 5, 6] : '4,5,6' as any,
          submissionDeadlineDay: 3,
          submissionDeadlineHour: 18,
        },
      },
      shiftTemplates: {
        createMany: {
          data: [
            {
              name: 'משמרת בוקר',
              shiftType: 'MORNING',
              startTime: '11:00',
              endTime: '18:00',
              minStaff: 2,
              maxStaff: 5,
            },
            {
              name: 'משמרת ערב',
              shiftType: 'EVENING',
              startTime: '18:00',
              endTime: '22:00',
              minStaff: 2,
              maxStaff: 5,
            },
            {
              name: 'משמרת סגירה',
              shiftType: 'EVENING_CLOSE',
              startTime: '18:00',
              endTime: '00:00',
              minStaff: 1,
              maxStaff: 3,
            },
          ],
        },
      },
    },
  });

  // Create job categories
  const waiterCategory = await prisma.jobCategory.create({
    data: { organizationId: organization.id, name: 'waiter', nameHe: 'מלצר', color: '#3b82f6' },
  });
  await prisma.jobCategory.create({
    data: { organizationId: organization.id, name: 'cook', nameHe: 'טבח', color: '#ef4444' },
  });
  await prisma.jobCategory.create({
    data: { organizationId: organization.id, name: 'sushiman', nameHe: 'סושימן', color: '#10b981' },
  });
  await prisma.jobCategory.create({
    data: { organizationId: organization.id, name: 'bartender', nameHe: 'ברמן', color: '#f59e0b' },
  });
  await prisma.jobCategory.create({
    data: { organizationId: organization.id, name: 'host', nameHe: 'מארח', color: '#8b5cf6' },
  });
  await prisma.jobCategory.create({
    data: { organizationId: organization.id, name: 'dishwasher', nameHe: 'שוטף כלים', color: '#6b7280' },
  });

  // Create admin user
  await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: 'admin@demo.com',
      passwordHash: await bcrypt.hash('admin123', 12),
      firstName: 'מנהל',
      lastName: 'מערכת',
      role: 'ADMIN',
      employmentType: 'FULL_TIME',
      isApproved: true,
      hourlyWage: 0,
    },
  });

  // Create worker user
  await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: 'worker@demo.com',
      passwordHash: await bcrypt.hash('worker123', 12),
      firstName: 'ישראל',
      lastName: 'ישראלי',
      role: 'EMPLOYEE',
      employmentType: 'FULL_TIME',
      isApproved: true,
      hourlyWage: 45,
      jobCategoryId: waiterCategory.id,
    },
  });

  console.log('✅ Created demo organization:', organization.name);
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('📧 LOGIN CREDENTIALS');
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log('👤 ADMIN (מנהל):');
  console.log('   Email:    admin@demo.com');
  console.log('   Password: admin123');
  console.log('');
  console.log('👷 WORKER (עובד):');
  console.log('   Email:    worker@demo.com');
  console.log('   Password: worker123');
  console.log('');
  console.log('═══════════════════════════════════════════');
  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
