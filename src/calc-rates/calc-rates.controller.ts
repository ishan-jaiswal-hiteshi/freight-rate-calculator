/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { LocationRateService } from './calc-rates.service';

@Controller('calc-rate')
export class LocationRateController {
  constructor(private readonly locationRateService: LocationRateService) {}

  @Post('add-hub')
  async addHub(@Body() body: any) {
    const { state, city, tyre10Rate, tyre12Rate, tyre14Rate } = body;

    if (!state || !city || !tyre10Rate || !tyre12Rate || !tyre14Rate) {
      throw new BadRequestException('Missing required fields');
    }

    try {
      return await this.locationRateService.addHub({
        state,
        city,
        pincode: body.pincode,
        tyre10Rate,
        tyre12Rate,
        tyre14Rate,
      });
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  @Post()
  async calculateRates(@Body() body: any) {
    if (!body.state || !body.city) {
      throw new BadRequestException('State and city are required');
    }

    try {
      return await this.locationRateService.calculateRates(
        body.state,
        body.city,
      );
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }
}
