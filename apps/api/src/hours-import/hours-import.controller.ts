import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer'; // Import for Express.Multer types
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { HoursImportService } from './hours-import.service';

@Controller('hours-import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
export class HoursImportController {
  constructor(private readonly hoursImportService: HoursImportService) {}

  /**
   * Upload an Excel file and get a preview of parsed data
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, callback) => {
        const allowedTypes = [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
          'application/vnd.ms-excel', // .xls
          'text/csv',
        ];
        const allowedExtensions = ['.xlsx', '.xls', '.csv'];
        const ext = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();

        if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
          callback(null, true);
        } else {
          callback(
            new BadRequestException('Only Excel files (.xlsx, .xls) and CSV files are allowed'),
            false,
          );
        }
      },
    }),
  )
  async uploadExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body('monthYear') monthYear: string,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.hoursImportService.parseAndPreview(
      file.buffer,
      file.originalname,
      req.user.organizationId,
      undefined,
      monthYear,
    );
  }

  /**
   * Re-upload with manual worker mapping overrides
   */
  @Post('upload-with-mapping')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        const allowedExtensions = ['.xlsx', '.xls', '.csv'];
        const ext = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();
        if (allowedExtensions.includes(ext)) {
          callback(null, true);
        } else {
          callback(new BadRequestException('Only Excel files are allowed'), false);
        }
      },
    }),
  )
  async uploadWithMapping(
    @UploadedFile() file: Express.Multer.File,
    @Body('mapping') mappingJson: string,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    let mapping: { [excelName: string]: string } = {};
    if (mappingJson) {
      try {
        mapping = JSON.parse(mappingJson);
      } catch {
        throw new BadRequestException('Invalid mapping data');
      }
    }

    return this.hoursImportService.parseAndPreview(
      file.buffer,
      file.originalname,
      req.user.organizationId,
      mapping,
    );
  }

  /**
   * Apply the import after user confirmation
   */
  @Post('apply/:sessionId')
  async applyImport(
    @Param('sessionId') sessionId: string,
    @Body() body: { workerMapping: { [excelName: string]: string }; monthYear?: string },
    @Request() req: any,
  ) {
    return this.hoursImportService.applyImport(
      sessionId,
      req.user.organizationId,
      body.workerMapping || {},
      body.monthYear,
      req.user.id,
    );
  }

  /**
   * Get list of all employees for manual matching dropdown
   */
  @Get('employees')
  async getEmployees(@Request() req: any) {
    return this.hoursImportService.getOrganizationEmployees(req.user.organizationId);
  }
}
