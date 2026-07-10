export type ZoneType = 'gate' | 'concourse' | 'seating' | 'amenity';
export type ZoneStatus = 'open' | 'closed';

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  stepFree: boolean;
  status: ZoneStatus;
  capacity: number;
  currentOccupancy: number;
  x: number; // coordinates for UI rendering
  y: number;
}

export interface Edge {
  id: string;
  fromZoneId: string;
  toZoneId: string;
  distanceMeters: number;
  stepFree: boolean;
}

export class StadiumGraph {
  private zones: Map<string, Zone> = new Map();
  private adjacencyList: Map<string, Edge[]> = new Map();

  constructor() {
    this.initializeDefaultGraph();
  }

  public addZone(zone: Zone): void {
    this.zones.set(zone.id, zone);
    if (!this.adjacencyList.has(zone.id)) {
      this.adjacencyList.set(zone.id, []);
    }
  }

  public addEdge(edge: Edge): void {
    // Add directed edge
    const edges = this.adjacencyList.get(edge.fromZoneId) || [];
    edges.push(edge);
    this.adjacencyList.set(edge.fromZoneId, edges);

    // Also add the reverse edge since stadium paths are bidirectionally walkable
    const reverseEdgeId = `${edge.toZoneId}-${edge.fromZoneId}`;
    const reverseEdges = this.adjacencyList.get(edge.toZoneId) || [];
    // Ensure we don't duplicate
    if (!reverseEdges.some(e => e.id === reverseEdgeId || (e.fromZoneId === edge.toZoneId && e.toZoneId === edge.fromZoneId))) {
      reverseEdges.push({
        id: reverseEdgeId,
        fromZoneId: edge.toZoneId,
        toZoneId: edge.fromZoneId,
        distanceMeters: edge.distanceMeters,
        stepFree: edge.stepFree
      });
      this.adjacencyList.set(edge.toZoneId, reverseEdges);
    }
  }

  public getZone(id: string): Zone | undefined {
    return this.zones.get(id);
  }

  public getAllZones(): Zone[] {
    return Array.from(this.zones.values());
  }

  public getNeighbors(zoneId: string): Edge[] {
    return this.adjacencyList.get(zoneId) || [];
  }

  public updateZoneStatus(zoneId: string, status: ZoneStatus): boolean {
    const zone = this.zones.get(zoneId);
    if (zone) {
      zone.status = status;
      return true;
    }
    return false;
  }

  public updateZoneOccupancy(zoneId: string, occupancy: number): boolean {
    const zone = this.zones.get(zoneId);
    if (zone) {
      zone.currentOccupancy = Math.max(0, Math.min(zone.capacity, occupancy));
      return true;
    }
    return false;
  }

  private initializeDefaultGraph(): void {
    // Set up standard stadium nodes representing a real World Cup venue
    // Coordinate space: 0-1000 for SVG mapping
    const defaultZones: Zone[] = [
      // Gates (Outer perimeter)
      { id: 'gate_1', name: 'Gate 1 (North-East)', type: 'gate', stepFree: true, status: 'open', capacity: 15000, currentOccupancy: 3000, x: 750, y: 150 },
      { id: 'gate_2', name: 'Gate 2 (East)', type: 'gate', stepFree: true, status: 'open', capacity: 15000, currentOccupancy: 4500, x: 900, y: 500 },
      { id: 'gate_3', name: 'Gate 3 (South-East - Wheelchair Access)', type: 'gate', stepFree: true, status: 'open', capacity: 10000, currentOccupancy: 2000, x: 750, y: 850 },
      { id: 'gate_4', name: 'Gate 4 (South)', type: 'gate', stepFree: false, status: 'open', capacity: 12000, currentOccupancy: 8000, x: 500, y: 950 }, // Non-accessible stairs gate
      { id: 'gate_5', name: 'Gate 5 (South-West)', type: 'gate', stepFree: true, status: 'open', capacity: 15000, currentOccupancy: 5000, x: 250, y: 850 },
      { id: 'gate_6', name: 'Gate 6 (West)', type: 'gate', stepFree: true, status: 'open', capacity: 15000, currentOccupancy: 12000, x: 100, y: 500 }, // High density gate
      { id: 'gate_7', name: 'Gate 7 (North-West)', type: 'gate', stepFree: true, status: 'open', capacity: 10000, currentOccupancy: 1000, x: 250, y: 150 },
      { id: 'gate_8', name: 'Gate 8 (North)', type: 'gate', stepFree: false, status: 'open', capacity: 12000, currentOccupancy: 2500, x: 500, y: 50 },

      // Concourses (Intermediate transit zones)
      { id: 'concourse_n', name: 'Concourse North', type: 'concourse', stepFree: true, status: 'open', capacity: 25000, currentOccupancy: 15000, x: 500, y: 250 },
      { id: 'concourse_e', name: 'Concourse East', type: 'concourse', stepFree: true, status: 'open', capacity: 25000, currentOccupancy: 12000, x: 750, y: 500 },
      { id: 'concourse_s', name: 'Concourse South', type: 'concourse', stepFree: true, status: 'open', capacity: 25000, currentOccupancy: 22000, x: 500, y: 750 }, // Congested
      { id: 'concourse_w', name: 'Concourse West', type: 'concourse', stepFree: true, status: 'open', capacity: 25000, currentOccupancy: 8000, x: 250, y: 500 },

      // Seating Blocks (Inner perimeter)
      { id: 'block_a1', name: 'Seating Block A1', type: 'seating', stepFree: false, status: 'open', capacity: 5000, currentOccupancy: 4200, x: 450, y: 350 }, // Standard stairs block
      { id: 'block_a2', name: 'Seating Block A2 (Accessible)', type: 'seating', stepFree: true, status: 'open', capacity: 3000, currentOccupancy: 1500, x: 550, y: 350 },
      { id: 'block_b1', name: 'Seating Block B1', type: 'seating', stepFree: false, status: 'open', capacity: 5000, currentOccupancy: 3800, x: 650, y: 450 },
      { id: 'block_b2', name: 'Seating Block B2 (Accessible)', type: 'seating', stepFree: true, status: 'open', capacity: 3000, currentOccupancy: 2000, x: 650, y: 550 },
      { id: 'block_c1', name: 'Seating Block C1', type: 'seating', stepFree: false, status: 'open', capacity: 5000, currentOccupancy: 4900, x: 550, y: 650 },
      { id: 'block_c2', name: 'Seating Block C2 (Accessible)', type: 'seating', stepFree: true, status: 'open', capacity: 3000, currentOccupancy: 1100, x: 450, y: 650 },
      { id: 'block_d1', name: 'Seating Block D1', type: 'seating', stepFree: false, status: 'open', capacity: 5000, currentOccupancy: 2100, x: 350, y: 550 },
      { id: 'block_d2', name: 'Seating Block D2 (Accessible)', type: 'seating', stepFree: true, status: 'open', capacity: 3000, currentOccupancy: 900, x: 350, y: 450 },

      // Amenities (Scattered off concourses)
      { id: 'amenity_restroom_1', name: 'Restroom Block N', type: 'amenity', stepFree: false, status: 'open', capacity: 100, currentOccupancy: 80, x: 420, y: 200 },
      { id: 'amenity_restroom_acc_1', name: 'Wheelchair-Accessible Restroom E', type: 'amenity', stepFree: true, status: 'open', capacity: 50, currentOccupancy: 10, x: 800, y: 450 },
      { id: 'amenity_medical_1', name: 'Medical Station South', type: 'amenity', stepFree: true, status: 'open', capacity: 200, currentOccupancy: 30, x: 500, y: 820 },
      { id: 'amenity_prayer_1', name: 'Multi-Faith Prayer Room W', type: 'amenity', stepFree: true, status: 'open', capacity: 80, currentOccupancy: 15, x: 200, y: 480 },
      { id: 'amenity_family_1', name: 'Family & Sensory Room N', type: 'amenity', stepFree: true, status: 'open', capacity: 100, currentOccupancy: 40, x: 580, y: 200 },
      { id: 'amenity_food_1', name: 'Concourse Food Court S', type: 'amenity', stepFree: false, status: 'open', capacity: 1000, currentOccupancy: 950, x: 500, y: 700 }
    ];

    defaultZones.forEach(z => this.addZone(z));

    // Connect Gates to Concourses
    const defaultEdges: Edge[] = [
      // Gate 1 to Concourse North
      { id: 'edge_g1_cn', fromZoneId: 'gate_1', toZoneId: 'concourse_n', distanceMeters: 100, stepFree: true },
      // Gate 2 to Concourse East
      { id: 'edge_g2_ce', fromZoneId: 'gate_2', toZoneId: 'concourse_e', distanceMeters: 80, stepFree: true },
      // Gate 3 to Concourse East & South
      { id: 'edge_g3_ce', fromZoneId: 'gate_3', toZoneId: 'concourse_e', distanceMeters: 110, stepFree: true },
      { id: 'edge_g3_cs', fromZoneId: 'gate_3', toZoneId: 'concourse_s', distanceMeters: 120, stepFree: true },
      // Gate 4 to Concourse South (Stairs only!)
      { id: 'edge_g4_cs', fromZoneId: 'gate_4', toZoneId: 'concourse_s', distanceMeters: 60, stepFree: false },
      // Gate 5 to Concourse South & West
      { id: 'edge_g5_cs', fromZoneId: 'gate_5', toZoneId: 'concourse_s', distanceMeters: 120, stepFree: true },
      { id: 'edge_g5_cw', fromZoneId: 'gate_5', toZoneId: 'concourse_w', distanceMeters: 110, stepFree: true },
      // Gate 6 to Concourse West
      { id: 'edge_g6_cw', fromZoneId: 'gate_6', toZoneId: 'concourse_w', distanceMeters: 80, stepFree: true },
      // Gate 7 to Concourse North
      { id: 'edge_g7_cn', fromZoneId: 'gate_7', toZoneId: 'concourse_n', distanceMeters: 100, stepFree: true },
      // Gate 8 to Concourse North (Stairs only!)
      { id: 'edge_g8_cn', fromZoneId: 'gate_8', toZoneId: 'concourse_n', distanceMeters: 60, stepFree: false },

      // Connect Concourses together (Ring Road style)
      { id: 'edge_cn_ce', fromZoneId: 'concourse_n', toZoneId: 'concourse_e', distanceMeters: 250, stepFree: true },
      { id: 'edge_ce_cs', fromZoneId: 'concourse_e', toZoneId: 'concourse_s', distanceMeters: 250, stepFree: true },
      { id: 'edge_cs_cw', fromZoneId: 'concourse_s', toZoneId: 'concourse_w', distanceMeters: 250, stepFree: true },
      { id: 'edge_cw_cn', fromZoneId: 'concourse_w', toZoneId: 'concourse_n', distanceMeters: 250, stepFree: true },

      // Connect Concourses to Seating Blocks
      // Concourse North connects to Blocks A1, A2, D2
      { id: 'edge_cn_ba1', fromZoneId: 'concourse_n', toZoneId: 'block_a1', distanceMeters: 90, stepFree: false }, // stairs only
      { id: 'edge_cn_ba2', fromZoneId: 'concourse_n', toZoneId: 'block_a2', distanceMeters: 95, stepFree: true }, // ramp/elevator
      { id: 'edge_cn_bd2', fromZoneId: 'concourse_n', toZoneId: 'block_d2', distanceMeters: 120, stepFree: true },

      // Concourse East connects to Blocks B1, B2, A2
      { id: 'edge_ce_bb1', fromZoneId: 'concourse_e', toZoneId: 'block_b1', distanceMeters: 90, stepFree: false }, // stairs only
      { id: 'edge_ce_bb2', fromZoneId: 'concourse_e', toZoneId: 'block_b2', distanceMeters: 95, stepFree: true }, // ramp
      { id: 'edge_ce_ba2', fromZoneId: 'concourse_e', toZoneId: 'block_a2', distanceMeters: 120, stepFree: true },

      // Concourse South connects to Blocks C1, C2, B2
      { id: 'edge_cs_bc1', fromZoneId: 'concourse_s', toZoneId: 'block_c1', distanceMeters: 90, stepFree: false }, // stairs only
      { id: 'edge_cs_bc2', fromZoneId: 'concourse_s', toZoneId: 'block_c2', distanceMeters: 95, stepFree: true }, // elevator
      { id: 'edge_cs_bb2', fromZoneId: 'concourse_s', toZoneId: 'block_b2', distanceMeters: 120, stepFree: true },

      // Concourse West connects to Blocks D1, D2, C2
      { id: 'edge_cw_bd1', fromZoneId: 'concourse_w', toZoneId: 'block_d1', distanceMeters: 90, stepFree: false }, // stairs only
      { id: 'edge_cw_bd2', fromZoneId: 'concourse_w', toZoneId: 'block_d2', distanceMeters: 95, stepFree: true }, // ramp
      { id: 'edge_cw_bc2', fromZoneId: 'concourse_w', toZoneId: 'block_c2', distanceMeters: 120, stepFree: true },

      // Connect Amenities to Concourses or nearby blocks
      { id: 'edge_cn_res1', fromZoneId: 'concourse_n', toZoneId: 'amenity_restroom_1', distanceMeters: 30, stepFree: false }, // Stairs only restroom
      { id: 'edge_ce_resacc1', fromZoneId: 'concourse_e', toZoneId: 'amenity_restroom_acc_1', distanceMeters: 40, stepFree: true }, // Accessible restroom
      { id: 'edge_cs_med1', fromZoneId: 'concourse_s', toZoneId: 'amenity_medical_1', distanceMeters: 50, stepFree: true },
      { id: 'edge_cw_pray1', fromZoneId: 'concourse_w', toZoneId: 'amenity_prayer_1', distanceMeters: 35, stepFree: true },
      { id: 'edge_cn_fam1', fromZoneId: 'concourse_n', toZoneId: 'amenity_family_1', distanceMeters: 45, stepFree: true },
      { id: 'edge_cs_food1', fromZoneId: 'concourse_s', toZoneId: 'amenity_food_1', distanceMeters: 40, stepFree: false }
    ];

    defaultEdges.forEach(e => this.addEdge(e));
  }
}
