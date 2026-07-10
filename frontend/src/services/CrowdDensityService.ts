import { Zone } from './StadiumGraph';

export class CrowdDensityService {
  public getDensityScore(zone: Zone): number {
    if (!zone || zone.capacity <= 0) return 0;
    return Math.max(0, Math.min(1.0, zone.currentOccupancy / zone.capacity));
  }

  public getCongestionLevel(score: number): 'low' | 'moderate' | 'high' | 'critical' {
    if (score < 0.3) return 'low';
    if (score < 0.6) return 'moderate';
    if (score < 0.8) return 'high';
    return 'critical';
  }

  public simulateUpdates(zones: Zone[]): Zone[] {
    return zones.map(zone => {
      if (zone.status === 'closed') {
        zone.currentOccupancy = 0;
        return zone;
      }
      const changePercent = (Math.random() - 0.5) * 0.1;
      const changeAmount = Math.round(zone.capacity * changePercent);
      zone.currentOccupancy = Math.max(0, Math.min(zone.capacity, zone.currentOccupancy + changeAmount));
      return zone;
    });
  }
}
