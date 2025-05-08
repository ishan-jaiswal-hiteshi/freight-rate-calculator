import { Schema, Document } from 'mongoose';

export interface Rate extends Document {
  newDestination: string;
  nearestHub: string;
  distance: number;
  tyre10Rate: number;
  tyre12Rate: number;
  tyre14Rate: number;
  destLat: number;
  destLon: number;
  hubLat: number;
  hubLon: number;
}

export const RateSchema = new Schema<Rate>({
  newDestination: { type: String },
  nearestHub: { type: String },
  distance: { type: Number },
  tyre10Rate: { type: Number },
  tyre12Rate: { type: Number },
  tyre14Rate: { type: Number },
  destLat: { type: Number },
  destLon: { type: Number },
  hubLat: { type: Number },
  hubLon: { type: Number },
});
