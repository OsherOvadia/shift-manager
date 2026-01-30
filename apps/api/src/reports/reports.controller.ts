import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('weekly-costs')
  getWeeklyCosts(@Query('date') date: string, @Request() req: any) {
    const weekDate = date ? new Date(date) : new Date();
    return this.reportsService.getWeeklyShiftCosts(req.user.organizationId, weekDate);
  }

  @Get('monthly-overview')
  getMonthlyOverview(
    @Query('year') year: string,
    @Query('month') month: string,
    @Request() req: any,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    return this.reportsService.getMonthlyOverview(req.user.organizationId, y, m);
  }
}
