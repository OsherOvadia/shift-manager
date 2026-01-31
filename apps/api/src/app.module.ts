import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ShiftTemplatesModule } from './shift-templates/shift-templates.module';
import { AvailabilityModule } from './availability/availability.module';
import { SchedulesModule } from './schedules/schedules.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SettingsModule } from './settings/settings.module';
import { JobCategoriesModule } from './job-categories/job-categories.module';
import { ReportsModule } from './reports/reports.module';
import { DailyRevenuesModule } from './daily-revenues/daily-revenues.module';
import { DatabaseResetModule } from './database/database-reset.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ShiftTemplatesModule,
    AvailabilityModule,
    SchedulesModule,
    AssignmentsModule,
    NotificationsModule,
    SettingsModule,
    JobCategoriesModule,
    ReportsModule,
    DailyRevenuesModule,
    DatabaseResetModule,
  ],
})
export class AppModule {}
