// Quick script to check business settings in database
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📊 Checking business settings...\n');
  
  const settings = await prisma.businessSettings.findMany({
    include: {
      organization: {
        select: {
          name: true,
        },
      },
    },
  });

  settings.forEach((s) => {
    console.log(`Organization: ${s.organization.name}`);
    console.log(`  Weekend Days: ${JSON.stringify(s.weekendDays)} (type: ${Array.isArray(s.weekendDays) ? 'array' : typeof s.weekendDays})`);
    console.log(`  Submission Deadline: Day ${s.submissionDeadlineDay} at ${s.submissionDeadlineHour}:00`);
    console.log('');
  });
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
