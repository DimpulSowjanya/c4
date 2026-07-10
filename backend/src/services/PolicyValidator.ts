import { Zone, Edge } from './StadiumGraph.js';
import { CrowdDensityService } from './CrowdDensityService.js';

export class PolicyValidator {
  private densityService: CrowdDensityService;

  constructor(densityService: CrowdDensityService) {
    this.densityService = densityService;
  }

  /**
   * Pre-check validation before running route search.
   * Returns a validation message if a hard rule is breached, otherwise null.
   */
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

  /**
   * Evaluates if traversing an edge to a target zone is allowed under current policies.
   */
  public isTraversalAllowed(
    edge: Edge,
    targetZone: Zone,
    accessibilityRequired: boolean
  ): boolean {
    // 1. Closed zone check
    if (targetZone.status === 'closed') {
      return false;
    }

    // 2. Accessibility constraints
    if (accessibilityRequired) {
      if (!edge.stepFree || !targetZone.stepFree) {
        return false;
      }
    }

    return true;
  }

  /**
   * Performs audits on a generated path and generates safety/congestion/access warnings.
   */
  public validateRoutePath(pathZones: Zone[], accessibilityRequired: boolean): string[] {
    const warnings: string[] = [];

    for (const zone of pathZones) {
      const density = this.densityService.getDensityScore(zone);

      // Warning when zone crowd is extremely high
      if (density >= 0.8) {
        warnings.push(`Warning: ${zone.name} is reporting heavy congestion (${Math.round(density * 100)}% occupancy). Slow movement expected.`);
      }

      // Safeguard for disabled fans encountering temporary closures/crowds
      if (accessibilityRequired && density >= 0.7) {
        warnings.push(`Notice: High density in ${zone.name} may reduce accessibility maneuverability. Volunteers are stationed nearby.`);
      }
    }

    return warnings;
  }
}
