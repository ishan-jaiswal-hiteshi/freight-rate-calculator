import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFiles,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { RatesService } from './rates.services';
import * as XLSX from 'xlsx';

@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Post('upload-xlsx')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'hubsFile', maxCount: 1 },
        { name: 'destinationsFile', maxCount: 1 },
      ],
      {
        limits: { files: 2, fileSize: 5 * 1024 * 1024 }, // max 5MB file
      },
    ),
  )
  async uploadExcel(
    @UploadedFiles()
    files: {
      hubsFile?: Express.Multer.File[];
      destinationsFile?: Express.Multer.File[];
    },
    @Res() res: Response,
  ) {
    const hubsArray = files.hubsFile;
    const destArray = files.destinationsFile;

    if (!hubsArray || hubsArray.length === 0) {
      throw new BadRequestException('Missing hubsFile');
    }
    if (!destArray || destArray.length === 0) {
      throw new BadRequestException('Missing destinationsFile');
    }

    const hubsFile = hubsArray[0];
    const destinationsFile = destArray[0];

    const result = await this.ratesService.processExcelFiles(
      hubsFile,
      destinationsFile,
    );

    const worksheet = XLSX.utils.json_to_sheet(result);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rates');

    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="calculated_rates.xlsx"',
    });
    res.send(buffer);
  }
}
