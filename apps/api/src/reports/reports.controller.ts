import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('weekly-costs')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  getWeeklyCosts(@Query('date') date: string, @Request() req: any) {
    const weekDate = date ? new Date(date) : new Date();
    return this.reportsService.getWeeklyShiftCosts(req.user.organizationId, weekDate);
  }

  @Get('monthly-overview')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  getMonthlyOverview(
    @Query('year') year: string,
    @Query('month') month: string,
    @Request() req: any,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    return this.reportsService.getMonthlyOverview(req.user.organizationId, y, m);
  }

  /**
   * Get worker hours summary - accessible by the worker themselves
   */
  @Get('worker-hours-summary')
  getWorkerHoursSummary(@Request() req: any) {
    return this.reportsService.getWorkerHoursSummary(req.user.sub, req.user.organizationId);
  }

  /**
   * Get employee monthly cash tips - accessible by the employee themselves
   */
  @Get('employee-monthly-cash-tips')
  getEmployeeMonthlyCashTips(
    @Query('year') year: string,
    @Query('month') month: string,
    @Request() req: any,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    return this.reportsService.getEmployeeMonthlyCashTips(
      req.user.sub,
      req.user.organizationId,
      y,
      m,
    );
  }

  /**
   * Get kitchen staff monthly summary - accessible by kitchen staff themselves
   */
  @Get('kitchen-monthly-summary')
  getKitchenMonthlySummary(
    @Query('year') year: string,
    @Query('month') month: string,
    @Request() req: any,
  ) {
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    return this.reportsService.getKitchenMonthlySummary(
      req.user.sub,
      req.user.organizationId,
      y,
      m,
    );
  }

  /**
   * Get kitchen staff recent weeks - accessible by kitchen staff themselves
   */
  @Get('kitchen-recent-weeks')
  getKitchenRecentWeeks(@Request() req: any) {
    return this.reportsService.getKitchenRecentWeeks(
      req.user.sub,
      req.user.organizationId,
    );
  }
}
