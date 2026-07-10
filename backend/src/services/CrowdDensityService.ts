import { Zone } from './StadiumGraph.js';

export class CrowdDensityService {
  /**
   * Calculates the crowd density score for a zone (value between 0.0 and 1.0).
   * 0.0 means empty, 1.0 means fully occupied or congested.
   */
  public getDensityScore(zone: Zone): number {
    if (!zone || zone.capacity <= 0) return 0;
    const rawRatio = zone.currentOccupancy / zone.capacity;
    return Math.max(0, Math.min(1.0, rawRatio));
  }

  /**
   * Helper to fetch congestion warning level
   */
  public getCongestionLevel(score: number): 'low' | 'moderate' | 'high' | 'critical' {
    if (score < 0.3) return 'low';
    if (score < 0.6) return 'moderate';
    if (score < 0.8) return 'high';
    return 'critical';
  }

  /**
   * Generates minor random fluctuations in crowd occupancy to simulate active IoT sensors.
   * This logic can be toggled by the volunteer/staff dashboard.
   */
  public simulateUpdates(zones: Zone[]): Zone[] {
    return zones.map(zone => {
      // Don't modify closed zones to be busy
      if (zone.status === 'closed') {
        zone.currentOccupancy = 0;
        return zone;
      }

      // Small random walk: -5% to +5% of capacity
      const changePercent = (Math.random() - 0.5) * 0.1;
      const changeAmount = Math.round(zone.capacity * changePercent);
      const newOccupancy = Math.max(0, Math.min(zone.capacity, zone.currentOccupancy + changeAmount));
      zone.currentOccupancy = newOccupancy;
      return zone;
    });
  }
}
