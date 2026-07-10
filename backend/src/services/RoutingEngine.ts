import { StadiumGraph, Zone, Edge } from './StadiumGraph.js';
import { CrowdDensityService } from './CrowdDensityService.js';
import { PolicyValidator } from './PolicyValidator.js';

export interface RouteResult {
  path: string[];            // list of zone IDs
  waypoints: Zone[];         // list of Zone objects
  totalDistance: number;     // sum of edge distances
  estimatedTimeMin: number;   // walking time in minutes
  averageCongestion: number;   // average congestion score along path
  warnings: string[];        // safety and accessibility warnings
  landmarkCues?: string[];   // visual accessibility audio cues
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

  /**
   * Computes shortest path based on accessibility profiles and crowd levels.
   * Profiles: 'standard' | 'step_free' | 'low_sensory' | 'visual_assist'
   */
  public findRoute(
    fromId: string,
    toId: string,
    profile: 'standard' | 'step_free' | 'low_sensory' | 'visual_assist' = 'standard',
    edgesToPenalize: string[] = [] // Used for alternate route detour calculations
  ): RouteResult | null {
    const startZone = this.graph.getZone(fromId);
    const endZone = this.graph.getZone(toId);

    if (!startZone || !endZone) {
      return null;
    }

    const accessibilityRequired = profile === 'step_free' || profile === 'visual_assist';

    // Pre-flight checks with PolicyValidator
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

    // Initialize
    const allZones = this.graph.getAllZones();
    for (const zone of allZones) {
      distances.set(zone.id, Infinity);
      previous.set(zone.id, null);
      queue.add(zone.id);
    }
    distances.set(fromId, 0);

    while (queue.size > 0) {
      // Find node with minimum distance in queue
      let uId: string | null = null;
      let minDistance = Infinity;
      for (const id of queue) {
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

        // Apply Policy: Check if target node or edge is closed, or inaccessible if required
        const isAllowed = this.validator.isTraversalAllowed(edge, targetZone, accessibilityRequired);
        if (!isAllowed) {
          continue;
        }

        // Calculate Cost
        const density = this.densityService.getDensityScore(targetZone);
        
        // Define crowd penalty based on profile:
        // low_sensory profile strongly detours away from crowds (multiplier = 10.0)
        let crowdPenaltyMultiplier = 3.0;
        if (profile === 'low_sensory') {
          crowdPenaltyMultiplier = 10.0;
        }

        let edgeCost = edge.distanceMeters * (1.0 + crowdPenaltyMultiplier * density);

        // Apply penalty if this edge is flagged for detour search
        const edgeKey1 = `${uId}-${vId}`;
        const edgeKey2 = `${vId}-${uId}`;
        if (edgesToPenalize.includes(edgeKey1) || edgesToPenalize.includes(edgeKey2)) {
          edgeCost *= 6.0; // Heavily discourage edges on the primary path
        }

        const newDist = (distances.get(uId) !== undefined ? distances.get(uId)! : 0) + edgeCost;
        if (newDist < (distances.get(vId) || Infinity)) {
          distances.set(vId, newDist);
          previous.set(vId, uId);
        }
      }
    }

    // Reconstruct path
    const path: string[] = [];
    let current: string | null = toId;
    while (current !== null) {
      path.unshift(current);
      current = previous.get(current) || null;
    }

    if (path[0] !== fromId) {
      return null;
    }

    // Calculate actual metrics along path
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
    
    // Walk speed metrics
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

    // Validate path and aggregate warnings
    const warnings = this.validator.validateRoutePath(waypoints, accessibilityRequired);

    // Visual landmarks audio cues generation
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

  /**
   * Generates a secondary alternate detour route by penalizing the primary path
   */
  public findAlternateRoute(
    fromId: string,
    toId: string,
    profile: 'standard' | 'step_free' | 'low_sensory' | 'visual_assist' = 'standard',
    primaryPath: string[]
  ): RouteResult | null {
    if (primaryPath.length < 2) return null;

    // Generate edge keys to penalize
    const edgesToPenalize: string[] = [];
    for (let i = 0; i < primaryPath.length - 1; i++) {
      edgesToPenalize.push(`${primaryPath[i]}-${primaryPath[i + 1]}`);
    }

    // Re-run routing with penalized edges
    const alternate = this.findRoute(fromId, toId, profile, edgesToPenalize);

    // If alternate path is exactly the same, or failed to connect, return null
    if (!alternate || alternate.path.join(',') === primaryPath.join(',')) {
      return null;
    }

    return alternate;
  }

  /**
   * Helper to locate the nearest amenity of a specific type
   */
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
