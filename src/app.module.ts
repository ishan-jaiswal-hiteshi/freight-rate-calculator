import { Module } from '@nestjs/common';
import { RatesModule } from './rates/rates.module';
import { MongooseModule } from '@nestjs/mongoose';
import { LocationRateModule } from './calc-rates/calc-rates.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/freight_rate_db',
    ),
    RatesModule,
    LocationRateModule,
  ],
})
export class AppModule {}
