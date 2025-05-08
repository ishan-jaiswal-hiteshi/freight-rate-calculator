/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { Hub } from './hubs.schema';
import { LocationRate } from './calc0rates-schema';

@Injectable()
export class LocationRateService {
  private readonly logger = new Logger(LocationRateService.name);
  private coordCache = new Map<string, { lat: number; lon: number }>();

  constructor(
    @InjectModel('Hub') private hubModel: Model<Hub>,
    @InjectModel('LocationRate') private locationRateModel: Model<LocationRate>,
  ) {}

  async validateCityExistence(
    place: string,
  ): Promise<{ lat: number; lon: number }> {
    if (this.coordCache.has(place)) return this.coordCache.get(place)!;

    const { data } = await axios.get(
      'https://nominatim.openstreetmap.org/search',
      {
        params: { q: place, format: 'json', limit: 1 },
        headers: { 'User-Agent': 'freight-calculator/1.0' },
        timeout: 5000,
      },
    );

    if (!Array.isArray(data) || data.length === 0)
      throw new Error(`No city found with the details: "${place}"`);

    const coords = { lat: +data[0].lat, lon: +data[0].lon };
    this.coordCache.set(place, coords);
    return coords;
  }

  async addHub(data: {
    state: string;
    city: string;
    pincode?: string;
    tyre10Rate: number;
    tyre12Rate: number;
    tyre14Rate: number;
  }) {
    const state = data.state.trim().toLowerCase();
    const city = data.city.trim().toLowerCase();
    const pincode = data.pincode?.trim();

    // Check if same city/state/zip already exists
    const existing = await this.hubModel.findOne({
      state: new RegExp(`^${state}$`, 'i'),
      city: new RegExp(`^${city}$`, 'i'),
      ...(pincode ? { pincode } : {}),
    });

    if (existing) {
      if (pincode && existing.pincode !== pincode) {
        // Allow insert if zip differs
      } else {
        return { message: 'Hub already exists for this location' };
      }
    }

    // Validate city using API
    const placeString = pincode
      ? `${city}, ${pincode}, ${state}, India`
      : `${city}, ${state}, India`;

    const coords = await this.validateCityExistence(placeString);

    const hub = new this.hubModel({
      city,
      state,
      pincode,
      tyre10Rate: data.tyre10Rate,
      tyre12Rate: data.tyre12Rate,
      tyre14Rate: data.tyre14Rate,
      latitude: coords.lat,
      longitude: coords.lon,
    });

    await hub.save();
    return { message: 'Hub added successfully', hub };
  }

  async calculateRates(state: string, city: string) {
    state = state.trim().toLowerCase();
    city = city.trim().toLowerCase();

    const place = `${city}, ${state}, India`;
    const cityCoords = await this.validateCityExistence(place);

    const existingHub = await this.hubModel.findOne({
      city: new RegExp(`^${city}$`, 'i'),
      state: new RegExp(`^${state}$`, 'i'),
    });

    // Get pincode if possible from the API result
    const { data } = await axios.get(
      'https://nominatim.openstreetmap.org/search',
      {
        params: { q: place, format: 'json', limit: 1, addressdetails: 1 },
        headers: { 'User-Agent': 'freight-calculator/1.0' },
        timeout: 5000,
      },
    );
    const pincode = data?.[0]?.address?.postcode || undefined;

    if (existingHub) {
      const payload = {
        state,
        city,
        pincode,
        latitude: cityCoords.lat,
        longitude: cityCoords.lon,
        baseTyre10Rate: existingHub.tyre10Rate,
        baseTyre12Rate: existingHub.tyre12Rate,
        baseTyre14Rate: existingHub.tyre14Rate,
        tyre10Rate: existingHub.tyre10Rate,
        tyre12Rate: existingHub.tyre12Rate,
        tyre14Rate: existingHub.tyre14Rate,
        distance: 0,
        nearestHub: existingHub.city,
      };

      await this.locationRateModel.findOneAndUpdate(
        { city, state },
        { $set: payload },
        { upsert: true },
      );

      return payload;
    }

    const allHubs = await this.hubModel.find({});
    if (!allHubs.length)
      throw new Error('No hubs available to compare distance');

    let nearestHub = allHubs[0];
    let minDistance = this.haversine(cityCoords, {
      lat: nearestHub.latitude,
      lon: nearestHub.longitude,
    });

    for (const hub of allHubs.slice(1)) {
      const dist = this.haversine(cityCoords, {
        lat: hub.latitude,
        lon: hub.longitude,
      });
      if (dist < minDistance) {
        minDistance = dist;
        nearestHub = hub;
      }
    }

    const indoreCoords = await this.validateCityExistence(
      'Indore, Madhya Pradesh, India',
    );
    const indoreToHubDistance = this.haversine(indoreCoords, {
      lat: nearestHub.latitude,
      lon: nearestHub.longitude,
    });
    const totalDistance = indoreToHubDistance + minDistance;

    const tyre10Rate = Math.round(
      (nearestHub.tyre10Rate * totalDistance) / indoreToHubDistance,
    );
    const tyre12Rate = Math.round(
      (nearestHub.tyre12Rate * totalDistance) / indoreToHubDistance,
    );
    const tyre14Rate = Math.round(
      (nearestHub.tyre14Rate * totalDistance) / indoreToHubDistance,
    );

    const locationData = {
      state,
      city,
      pincode,
      latitude: cityCoords.lat,
      longitude: cityCoords.lon,
      baseTyre10Rate: nearestHub.tyre10Rate,
      baseTyre12Rate: nearestHub.tyre12Rate,
      baseTyre14Rate: nearestHub.tyre14Rate,
      tyre10Rate,
      tyre12Rate,
      tyre14Rate,
      distance: Math.round(minDistance),
      nearestHub: nearestHub.city,
    };

    await this.locationRateModel.findOneAndUpdate(
      { city, state },
      { $set: locationData },
      { upsert: true },
    );

    return locationData;
  }

  private haversine(
    a: { lat: number; lon: number },
    b: { lat: number; lon: number },
  ): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const sLat = Math.sin(dLat / 2);
    const sLon = Math.sin(dLon / 2);

    const hav =
      sLat * sLat +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sLon * sLon;

    return 2 * R * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
  }
}
