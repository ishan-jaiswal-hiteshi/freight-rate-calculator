// location-rate.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LocationRateController } from './calc-rates.controller';
import { LocationRateService } from './calc-rates.service';
import { LocationRateSchema } from './calc0rates-schema';
import { HubSchema } from './hubs.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'LocationRate', schema: LocationRateSchema },
      { name: 'Hub', schema: HubSchema },
    ]),
  ],
  controllers: [LocationRateController],
  providers: [LocationRateService],
})
export class LocationRateModule {}
