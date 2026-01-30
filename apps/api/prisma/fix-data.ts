// Script to fix existing organization data with correct weekend days and shift times
// Run with: npx ts-node prisma/fix-data.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing existing organization data...\n');

  // 1. Update all business settings with correct weekend days (Thu=4, Fri=5, Sat=6)
  const settingsUpdate = await prisma.businessSettings.updateMany({
    data: {
      weekendDays: [4, 5, 6], // Thursday, Friday, Saturday
      submissionDeadlineDay: 3, // Wednesday
    },
  });
  console.log(`✅ Updated ${settingsUpdate.count} business settings with weekend days [4, 5, 6]`);

  // 2. Update shift templates with correct times
  // Morning: 11:00-18:00
  const morningUpdate = await prisma.shiftTemplate.updateMany({
    where: { shiftType: 'MORNING' },
    data: {
      startTime: '11:00',
      endTime: '18:00',
    },
  });
  console.log(`✅ Updated ${morningUpdate.count} MORNING shift templates to 11:00-18:00`);

  // Evening: 18:00-22:00
  const eveningUpdate = await prisma.shiftTemplate.updateMany({
    where: { shiftType: 'EVENING' },
    data: {
      startTime: '18:00',
      endTime: '22:00',
    },
  });
  console.log(`✅ Updated ${eveningUpdate.count} EVENING shift templates to 18:00-22:00`);

  // Evening + Close: 18:00-00:00
  const closeUpdate = await prisma.shiftTemplate.updateMany({
    where: { shiftType: 'EVENING_CLOSE' },
    data: {
      startTime: '18:00',
      endTime: '00:00',
    },
  });
  console.log(`✅ Updated ${closeUpdate.count} EVENING_CLOSE shift templates to 18:00-00:00`);

  // Verify the changes
  console.log('\n📊 Verifying changes...');
  
  const settings = await prisma.businessSettings.findMany();
  console.log('\nBusiness Settings:');
  settings.forEach(s => {
    console.log(`  - Org ${s.organizationId}: weekendDays = [${s.weekendDays.join(', ')}]`);
  });

  const templates = await prisma.shiftTemplate.findMany({
    orderBy: { shiftType: 'asc' },
  });
  console.log('\nShift Templates:');
  templates.forEach(t => {
    console.log(`  - ${t.name} (${t.shiftType}): ${t.startTime} - ${t.endTime}`);
  });

  console.log('\n✅ Data fix complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
