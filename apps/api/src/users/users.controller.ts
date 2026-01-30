import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApproveUserDto } from './dto/approve-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async findAll(@Request() req: any) {
    return this.usersService.findAll(req.user.organizationId);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async findPendingUsers(@Request() req: any) {
    return this.usersService.findPendingUsers(req.user.organizationId);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async approveUser(
    @Param('id') id: string,
    @Body() approveDto: ApproveUserDto,
    @Request() req: any,
  ) {
    return this.usersService.approveUser(id, req.user.organizationId, approveDto);
  }

  @Delete(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async rejectUser(@Param('id') id: string, @Request() req: any) {
    return this.usersService.rejectUser(id, req.user.organizationId);
  }

  @Get('employees')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async getActiveEmployees(@Request() req: any) {
    return this.usersService.getActiveEmployees(req.user.organizationId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.usersService.findOne(id, req.user.organizationId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: any,
  ) {
    return this.usersService.update(id, updateUserDto, req.user.sub, req.user.role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  async deactivate(@Param('id') id: string, @Request() req: any) {
    return this.usersService.deactivate(id, req.user.sub, req.user.role, req.user.organizationId);
  }
}
