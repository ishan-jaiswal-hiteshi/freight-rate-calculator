/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Rate } from './rates.schema';

interface HubRow {
  State: string;
  Destination: string;
  [key: string]: any;
}

interface DestRow {
  State?: string;
  'New Destination': string;
  [key: string]: any;
}

interface ExportRate {
  'New Destination': string;
  'Nearest Hub': string;
  'Distance (km)': number;
  '10 Tyre Rate': number;
  '12 Tyre Rate': number;
  '14 Tyre Rate': number;
}

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);
  private coordCache = new Map<string, { lat: number; lon: number }>();

  constructor(@InjectModel('Rate') private readonly rateModel: Model<Rate>) {}

  async processExcelFiles(
    hubsFile: Express.Multer.File,
    destFile: Express.Multer.File,
  ): Promise<ExportRate[]> {
    // 1) Clear old records
    //await this.rateModel.deleteMany({});

    // 2) Parse sheets as JSON (keep blank cells)
    const hubs = this.sheetToJson<HubRow>(hubsFile.buffer, { defval: '' });
    const dests = this.sheetToJson<DestRow>(destFile.buffer, { defval: '' });

    if (!hubs.length) {
      this.logger.warn('No hubs found in upload');
      return [];
    }

    // 3) Detect your three rate columns via fuzzy header matching
    const headers = Object.keys(hubs[0]);
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normMap = new Map(headers.map((h) => [normalize(h), h]));

    const findCol = (tyre: number) =>
      Array.from(normMap).find(
        ([n]) =>
          n.includes('freightrate') &&
          n.includes(tyre.toString()) &&
          n.includes('tyre'),
      )?.[1];
    const col10 = findCol(10),
      col12 = findCol(12),
      col14 = findCol(14);

    if (!col10 || !col12 || !col14) {
      throw new Error(
        `Rate columns not detected; headers: ${headers.join(', ')}`,
      );
    }

    // 4) Build hub→rates and hub→state maps
    const hubRates = new Map<string, { [tyre: number]: number }>();
    const hubStates = new Map<string, string>();
    for (const row of hubs) {
      const name = row.Destination.trim();
      hubStates.set(name, row.State.trim());
      hubRates.set(name, {
        10: this.parseCellNumber(row[col10]),
        12: this.parseCellNumber(row[col12]),
        14: this.parseCellNumber(row[col14]),
      });
    }

    // 5) Process each destination
    const output: ExportRate[] = [];
    for (const row of dests) {
      const destName = row['New Destination'].trim();
      const destState = (row.State || 'Madhya Pradesh').trim();

      // 5a) Try to geocode destination
      let destCoords: { lat: number; lon: number };
      try {
        destCoords = await this.getCoordinates(
          `${destName}, ${destState}, India`,
        );
      } catch {
        this.logger.warn(`Destination not found: "${destName}"`);
        output.push({
          'New Destination': destName,
          'Nearest Hub': 'Destination not found',
          'Distance (km)': 0,
          '10 Tyre Rate': 0,
          '12 Tyre Rate': 0,
          '14 Tyre Rate': 0,
        });
        continue;
      }

      // 5b) Geocode main hub once
      const mainHubCoords = await this.getCoordinates(
        `Indore, Madhya Pradesh, India`,
      );

      // 5c) Find nearest *valid* hub
      let nearestHub = '';
      let bestDist = Infinity;
      let hubCoords = { lat: 0, lon: 0 };

      for (const hubName of hubRates.keys()) {
        try {
          const coords = await this.getCoordinates(
            `${hubName}, ${hubStates.get(hubName)}, India`,
          );
          const d = this.haversineDistance(destCoords, coords);
          if (d < bestDist) {
            bestDist = d;
            nearestHub = hubName;
            hubCoords = coords;
          }
        } catch {
          this.logger.warn(`Could not geocode hub "${hubName}", skipping`);
        }
      }

      // 5d) If no hub could be geocoded, record and move on
      if (!nearestHub) {
        this.logger.warn(`No hub found for destination "${destName}"`);
        output.push({
          'New Destination': destName,
          'Nearest Hub': 'No valid hub found',
          'Distance (km)': 0,
          '10 Tyre Rate': 0,
          '12 Tyre Rate': 0,
          '14 Tyre Rate': 0,
        });
        continue;
      }

      // 5e) Compute rates and persist
      const base = hubRates.get(nearestHub)!;
      const hubDist = this.haversineDistance(mainHubCoords, hubCoords);

      const rate10 = this.calculateNewRate(base[10], hubDist, bestDist);
      const rate12 = this.calculateNewRate(base[12], hubDist, bestDist);
      const rate14 = this.calculateNewRate(base[14], hubDist, bestDist);

      await this.rateModel.create({
        newDestination: destName,
        nearestHub,
        distance: bestDist,
        tyre10Rate: rate10,
        tyre12Rate: rate12,
        tyre14Rate: rate14,
        destLat: destCoords.lat,
        destLon: destCoords.lon,
        hubLat: hubCoords.lat,
        hubLon: hubCoords.lon,
      });

      output.push({
        'New Destination': destName,
        'Nearest Hub': nearestHub,
        'Distance (km)': Math.round(bestDist),
        '10 Tyre Rate': Math.round(rate10),
        '12 Tyre Rate': Math.round(rate12),
        '14 Tyre Rate': Math.round(rate14),
      });
    }

    return output;
  }

  private calculateNewRate(
    baseRate: number,
    hubDistance: number,
    destDistance: number,
  ): number {
    const total = hubDistance + destDistance;
    return (baseRate * total) / hubDistance;
  }

  private parseCellNumber(cell: any): number {
    if (typeof cell === 'number') return cell;
    const cleaned = String(cell).replace(/[^\d.-]/g, '');
    const n = parseFloat(cleaned);
    return Number.isNaN(n) ? 0 : n;
  }

  private sheetToJson<T>(buffer: Buffer, opts = {}): T[] {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<T>(sheet, opts);
  }

  private async getCoordinates(
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
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error(`No geo for "${place}"`);
    }
    const coords = { lat: +data[0].lat, lon: +data[0].lon };
    this.coordCache.set(place, coords);
    return coords;
  }

  private haversineDistance(
    a: { lat: number; lon: number },
    b: { lat: number; lon: number },
  ): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat),
      dLon = toRad(b.lon - a.lon);
    const sLat = Math.sin(dLat / 2),
      sLon = Math.sin(dLon / 2);
    const hav =
      sLat * sLat +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sLon * sLon;
    return 2 * R * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
  }
}
