import { Zone, Edge } from './StadiumGraph';
import { CrowdDensityService } from './CrowdDensityService';

export class PolicyValidator {
  private densityService: CrowdDensityService;

  constructor(densityService: CrowdDensityService) {
    this.densityService = densityService;
  }

  public validateRouteEndpoints(
    startZone: Zone,
    endZone: Zone,
    accessibilityRequired: boolean
  ): string | null {
    if (startZone.status === 'closed') {
      return `Start zone ${startZone.name} is currently CLOSED. Please choose another starting gate or wait for staff updates.`;
    }
    if (endZone.status === 'closed') {
      return `Destination zone ${endZone.name} is currently CLOSED due to crowd control policies.`;
    }
    if (accessibilityRequired) {
      if (!startZone.stepFree) {
        return `Start zone ${startZone.name} is not wheelchair-accessible (step-free). Please use an accessible entrance.`;
      }
      if (!endZone.stepFree) {
        return `Destination ${endZone.name} does not have step-free access. Please contact stadium volunteers for assistant escort options.`;
      }
    }
    return null;
  }

  public isTraversalAllowed(
    edge: Edge,
    targetZone: Zone,
    accessibilityRequired: boolean
  ): boolean {
    if (targetZone.status === 'closed') {
      return false;
    }
    if (accessibilityRequired) {
      if (!edge.stepFree || !targetZone.stepFree) {
        return false;
      }
    }
    return true;
  }

  public validateRoutePath(pathZones: Zone[], accessibilityRequired: boolean): string[] {
    const warnings: string[] = [];
    for (const zone of pathZones) {
      const density = this.densityService.getDensityScore(zone);
      if (density >= 0.8) {
        warnings.push(`Warning: ${zone.name} is reporting heavy congestion (${Math.round(density * 100)}% occupancy). Slow movement expected.`);
      }
      if (accessibilityRequired && density >= 0.7) {
        warnings.push(`Notice: High density in ${zone.name} may reduce accessibility maneuverability. Volunteers are stationed nearby.`);
      }
    }
    return warnings;
  }
}
