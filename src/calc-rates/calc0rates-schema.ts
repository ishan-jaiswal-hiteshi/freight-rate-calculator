import { Schema, Document } from 'mongoose';

export interface LocationRate extends Document {
  state: string;
  city: string;
  pincode?: string;
  latitude: number;
  longitude: number;
  baseTyre10Rate: number;
  baseTyre12Rate: number;
  baseTyre14Rate: number;
  tyre10Rate?: number;
  tyre12Rate?: number;
  tyre14Rate?: number;
  distance?: number;
  nearestHub?: string;
}

export const LocationRateSchema = new Schema<LocationRate>({
  state: { type: String, required: true },
  city: { type: String, required: true },
  pincode: { type: String },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  baseTyre10Rate: { type: Number, required: true },
  baseTyre12Rate: { type: Number, required: true },
  baseTyre14Rate: { type: Number, required: true },
  tyre10Rate: { type: Number },
  tyre12Rate: { type: Number },
  tyre14Rate: { type: Number },
  distance: { type: Number },
  nearestHub: { type: String },
});
