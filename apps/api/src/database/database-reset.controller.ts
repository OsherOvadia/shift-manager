import { Controller, Get, Query, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('database-reset')
export class DatabaseResetController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async resetDatabase(@Query('secret') secret: string) {
    // Check if secret matches
    const RESET_SECRET = process.env.DB_RESET_SECRET || 'CHANGE_THIS_SECRET_12345';
    
    if (!secret || secret !== RESET_SECRET) {
      throw new UnauthorizedException('Invalid reset secret');
    }

    try {
      // Get all table names from the schema
      const tables = await this.prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables WHERE schemaname='public'
      `;

      // Drop all tables
      for (const { tablename } of tables) {
        if (tablename !== '_prisma_migrations') {
          await this.prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${tablename}" CASCADE`);
        }
      }

      // Drop migrations table too for clean slate
      await this.prisma.$executeRaw`DROP TABLE IF EXISTS "_prisma_migrations" CASCADE`;

      // Disconnect and reconnect
      await this.prisma.$disconnect();

      return {
        success: true,
        message: 'Database reset successfully! All tables dropped. Redeploy your API to recreate schema.',
        instructions: [
          '1. Go to Render dashboard',
          '2. Click on your shift-manager-api service',
          '3. Click "Manual Deploy" → "Clear build cache & deploy"',
          '4. Prisma will recreate all tables automatically',
          '5. IMPORTANT: Remove DB_RESET_SECRET from environment variables after reset',
        ],
      };
    } catch (error) {
      throw new InternalServerErrorException({
        message: 'Failed to reset database',
        error: error.message,
      });
    }
  }
}
