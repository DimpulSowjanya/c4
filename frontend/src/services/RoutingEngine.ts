import { StadiumGraph, Zone, Edge } from './StadiumGraph';
import { CrowdDensityService } from './CrowdDensityService';
import { PolicyValidator } from './PolicyValidator';

export interface RouteResult {
  path: string[];
  waypoints: Zone[];
  totalDistance: number;
  estimatedTimeMin: number;
  averageCongestion: number;
  warnings: string[];
  landmarkCues?: string[];
}

export class RoutingEngine {
  private graph: StadiumGraph;
  private densityService: CrowdDensityService;
  private validator: PolicyValidator;

  constructor(graph: StadiumGraph) {
    this.graph = graph;
    this.densityService = new CrowdDensityService();
    this.validator = new PolicyValidator(this.densityService);
  }

  public findRoute(
    fromId: string,
    toId: string,
    profile: 'standard' | 'step_free' | 'low_sensory' | 'visual_assist' = 'standard',
    edgesToPenalize: string[] = []
  ): RouteResult | null {
    console.log('[Routing Diagnostic] Graph state:', { 
      zonesCount: this.graph.getAllZones().length, 
      gate1Neighbors: this.graph.getNeighbors('gate_1'), 
      concourseNNeighbors: this.graph.getNeighbors('concourse_n') 
    });

    const startZone = this.graph.getZone(fromId);
    const endZone = this.graph.getZone(toId);

    if (!startZone || !endZone) {
      return null;
    }

    const accessibilityRequired = profile === 'step_free' || profile === 'visual_assist';
    const preFlightWarning = this.validator.validateRouteEndpoints(startZone, endZone, accessibilityRequired);
    if (preFlightWarning) {
      return {
        path: [],
        waypoints: [],
        totalDistance: 0,
        estimatedTimeMin: 0,
        averageCongestion: 0,
        warnings: [preFlightWarning]
      };
    }

    const distances: Map<string, number> = new Map();
    const previous: Map<string, string | null> = new Map();
    const queue: Set<string> = new Set();

    const allZones = this.graph.getAllZones();
    for (const zone of allZones) {
      distances.set(zone.id, Infinity);
      previous.set(zone.id, null);
      queue.add(zone.id);
    }
    distances.set(fromId, 0);

    while (queue.size > 0) {
      let uId: string | null = null;
      let minDistance = Infinity;
      
      // Fixed: Structural conversion matrix loop handles downlevel iteration flags safely
      const items = Array.from(queue);
      for (let i = 0; i < items.length; i++) {
        const id = items[i];
        const dist = distances.get(id) !== undefined ? distances.get(id)! : Infinity;
        if (dist < minDistance) {
          minDistance = dist;
          uId = id;
        }
      }

      if (uId === null || distances.get(uId) === Infinity) {
        break;
      }

      if (uId === toId) {
        break;
      }

      queue.delete(uId);

      const neighbors = this.graph.getNeighbors(uId);
      for (const edge of neighbors) {
        const vId = edge.toZoneId;
        if (!queue.has(vId)) continue;

        const targetZone = this.graph.getZone(vId);
        if (!targetZone) continue;

        const isAllowed = this.validator.isTraversalAllowed(edge, targetZone, accessibilityRequired);
        if (!isAllowed) {
          continue;
        }

        const density = this.densityService.getDensityScore(targetZone);
        let crowdPenaltyMultiplier = 3.0;
        if (profile === 'low_sensory') {
          crowdPenaltyMultiplier = 10.0;
        }

        let edgeCost = edge.distanceMeters * (1.0 + crowdPenaltyMultiplier * density);

        const edgeKey1 = `${uId}-${vId}`;
        const edgeKey2 = `${vId}-${uId}`;
        if (edgesToPenalize.includes(edgeKey1) || edgesToPenalize.includes(edgeKey2)) {
          edgeCost *= 6.0;
        }

        const newDist = (distances.get(uId) !== undefined ? distances.get(uId)! : 0) + edgeCost;
        if (newDist < (distances.get(vId) || Infinity)) {
          distances.set(vId, newDist);
          previous.set(vId, uId);
        }
      }
    }

    const path: string[] = [];
    let current: string | null = toId;
    while (current !== null) {
      path.unshift(current);
      current = previous.get(current) || null;
    }

    if (path.length === 0 || path[0] !== fromId) {
      return null;
    }

    let totalDistance = 0;
    const waypoints: Zone[] = [];
    let congestionSum = 0;

    for (let i = 0; i < path.length; i++) {
      const zone = this.graph.getZone(path[i])!;
      waypoints.push(zone);
      congestionSum += this.densityService.getDensityScore(zone);

      if (i > 0) {
        const prevId = path[i - 1];
        const edge = this.graph.getNeighbors(prevId).find(e => e.toZoneId === zone.id);
        if (edge) {
          totalDistance += edge.distanceMeters;
        }
      }
    }

    const averageCongestion = path.length > 0 ? congestionSum / path.length : 0;
    const baseSpeedMetersPerMin = 72;
    let totalWalkTimeMin = 0;
    for (let i = 1; i < path.length; i++) {
      const prevZone = this.graph.getZone(path[i - 1])!;
      const currZone = this.graph.getZone(path[i])!;
      const edge = this.graph.getNeighbors(prevZone.id).find(e => e.toZoneId === currZone.id);
      if (edge) {
        const destDensity = this.densityService.getDensityScore(currZone);
        const effectiveSpeed = baseSpeedMetersPerMin * (1.0 - 0.65 * destDensity);
        totalWalkTimeMin += edge.distanceMeters / effectiveSpeed;
      }
    }
    const estimatedTimeMin = Math.round(totalWalkTimeMin * 10) / 10;
    const warnings = this.validator.validateRoutePath(waypoints, accessibilityRequired);

    const landmarkCues: string[] = [];
    if (profile === 'visual_assist') {
      landmarkCues.push(`Accessible departure from ${startZone.name}.`);
      for (let i = 1; i < waypoints.length; i++) {
        const wp = waypoints[i];
        if (wp.type === 'concourse') {
          landmarkCues.push(`Enter ${wp.name}. High sensory alerts are stationed at help spots.`);
        } else if (wp.type === 'amenity') {
          landmarkCues.push(`Pass near ${wp.name}.`);
        }
      }
      landmarkCues.push(`Arrive safely at destination ${endZone.name}. Staff support triggers at seating lines.`);
    }

    return {
      path,
      waypoints,
      totalDistance,
      estimatedTimeMin: estimatedTimeMin > 0 ? estimatedTimeMin : 1,
      averageCongestion: Math.round(averageCongestion * 100) / 100,
      warnings,
      landmarkCues
    };
  }

  public findAlternateRoute(
    fromId: string,
    toId: string,
    profile: 'standard' | 'step_free' | 'low_sensory' | 'visual_assist' = 'standard',
    primaryPath: string[]
  ): RouteResult | null {
    if (primaryPath.length < 2) return null;

    const edgesToPenalize: string[] = [];
    for (let i = 0; i < primaryPath.length - 1; i++) {
      edgesToPenalize.push(`${primaryPath[i]}-${primaryPath[i + 1]}`);
    }

    const alternate = this.findRoute(fromId, toId, profile, edgesToPenalize);
    if (!alternate || alternate.path.join(',') === primaryPath.join(',')) {
      return null;
    }

    return alternate;
  }

  public findNearestAmenity(
    fromId: string,
    amenityType: string,
    profile: 'standard' | 'step_free' | 'low_sensory' | 'visual_assist' = 'standard'
  ): RouteResult | null {
    const allZones = this.graph.getAllZones();
    const accessibilityRequired = profile === 'step_free' || profile === 'visual_assist';
    const candidates = allZones.filter(z => 
      z.type === 'amenity' && 
      z.id.includes(amenityType) &&
      (!accessibilityRequired || z.stepFree)
    );

    let bestRoute: RouteResult | null = null;
    let minDistance = Infinity;

    for (const candidate of candidates) {
      const route = this.findRoute(fromId, candidate.id, profile);
      if (route && route.path.length > 0 && route.totalDistance < minDistance) {
        minDistance = route.totalDistance;
        bestRoute = route;
      }
    }

    return bestRoute;
  }
}
