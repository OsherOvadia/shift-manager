import { Module } from '@nestjs/common';
import { DatabaseResetController } from './database-reset.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DatabaseResetController],
})
export class DatabaseResetModule {}
