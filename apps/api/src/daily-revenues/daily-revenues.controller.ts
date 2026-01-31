import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { DailyRevenuesService } from './daily-revenues.service';
import { CreateDailyRevenueDto } from './dto/create-daily-revenue.dto';
import { UpdateDailyRevenueDto } from './dto/update-daily-revenue.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('daily-revenues')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DailyRevenuesController {
  constructor(private readonly dailyRevenuesService: DailyRevenuesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Req() req: Request, @Body() createDailyRevenueDto: CreateDailyRevenueDto) {
    return this.dailyRevenuesService.create(
      (req as any).user.organizationId,
      createDailyRevenueDto,
    );
  }

  @Get('range')
  @Roles('ADMIN', 'MANAGER')
  findByRange(
    @Req() req: Request,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.dailyRevenuesService.findByDateRange(
      (req as any).user.organizationId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get(':date')
  @Roles('ADMIN', 'MANAGER')
  findOne(@Req() req: Request, @Param('date') date: string) {
    return this.dailyRevenuesService.findOne(
      (req as any).user.organizationId,
      new Date(date),
    );
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() updateDailyRevenueDto: UpdateDailyRevenueDto,
  ) {
    return this.dailyRevenuesService.update(
      id,
      (req as any).user.organizationId,
      updateDailyRevenueDto,
    );
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.dailyRevenuesService.remove(id, (req as any).user.organizationId);
  }
}
