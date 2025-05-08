/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Module } from '@nestjs/common';
import { RatesController } from './rates.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { RateSchema } from './rates.schema';
import { RatesService } from './rates.services';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'Rate', schema: RateSchema }])],
  controllers: [RatesController],
  providers: [RatesService],
})
export class RatesModule {}
