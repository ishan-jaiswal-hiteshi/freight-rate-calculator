import { Schema, Document } from 'mongoose';

export interface Hub extends Document {
  state: string; // e.g. "Bhopal Hub"
  latitude: number;
  longitude: number;
  tyre10Rate: number; // base rate per ton at this hub
  tyre12Rate: number;
  tyre14Rate: number;
  city: string;
  pincode: string;
}

export const HubSchema = new Schema<Hub>({
  state: { type: String, required: true },
  city: { type: String, required: true },
  pincode: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  tyre10Rate: { type: Number, required: true },
  tyre12Rate: { type: Number, required: true },
  tyre14Rate: { type: Number, required: true },
});
