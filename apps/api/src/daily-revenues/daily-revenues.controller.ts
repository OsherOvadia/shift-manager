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
  create(@Req() req, @Body() createDailyRevenueDto: CreateDailyRevenueDto) {
    return this.dailyRevenuesService.create(
      req.user.organizationId,
      createDailyRevenueDto,
    );
  }

  @Get('range')
  @Roles('ADMIN', 'MANAGER')
  findByRange(
    @Req() req,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.dailyRevenuesService.findByDateRange(
      req.user.organizationId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get(':date')
  @Roles('ADMIN', 'MANAGER')
  findOne(@Req() req, @Param('date') date: string) {
    return this.dailyRevenuesService.findOne(
      req.user.organizationId,
      new Date(date),
    );
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(
    @Req() req,
    @Param('id') id: string,
    @Body() updateDailyRevenueDto: UpdateDailyRevenueDto,
  ) {
    return this.dailyRevenuesService.update(
      id,
      req.user.organizationId,
      updateDailyRevenueDto,
    );
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@Req() req, @Param('id') id: string) {
    return this.dailyRevenuesService.remove(id, req.user.organizationId);
  }
}
