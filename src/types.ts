/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Destination {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radius: number; // in meters
}

export type TripStatus = 'idle' | 'active' | 'triggered' | 'completed' | 'cancelled';

export interface TripHistoryItem {
  id: string;
  destinationName: string;
  lat: number;
  lon: number;
  radius: number;
  timestamp: string; // ISO String
  status: TripStatus;
  notes?: string;
}

export interface LocationPoint {
  lat: number;
  lon: number;
  accuracy: number; // in meters
  speed: number | null; // in m/s
  timestamp: number;
}

export interface SimulationParams {
  enabled: boolean;
  speedMultiplier: number; // in km/h
  currentPointIndex: number;
  route: LocationPoint[];
}
