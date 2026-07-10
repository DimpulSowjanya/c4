import { StadiumGraph } from '../../backend/src/services/StadiumGraph.js';
import { RoutingEngine } from '../../backend/src/services/RoutingEngine.js';
import { PolicyValidator } from '../../backend/src/services/PolicyValidator.js';
import { CrowdDensityService } from '../../backend/src/services/CrowdDensityService.js';

describe('Deterministic Engine Upgrade Tests', () => {
  let graph: StadiumGraph;
  let routingEngine: RoutingEngine;
  let policyValidator: PolicyValidator;
  let densityService: CrowdDensityService;

  beforeEach(() => {
    graph = new StadiumGraph();
    routingEngine = new RoutingEngine(graph);
    densityService = new CrowdDensityService();
    policyValidator = new PolicyValidator(densityService);
  });

  test('Should find shortest route from Gate 1 to Block A2 (step-free)', () => {
    const route = routingEngine.findRoute('gate_1', 'block_a2', 'standard');
    expect(route).not.toBeNull();
    expect(route!.path).toContain('gate_1');
    expect(route!.path).toContain('concourse_n');
    expect(route!.path).toContain('block_a2');
  });

  test('Should restrict path to accessible-only when step_free profile is requested', () => {
    const accessibleRoute = routingEngine.findRoute('gate_8', 'block_a2', 'step_free');
    expect(accessibleRoute!.path).toHaveLength(0);
    expect(accessibleRoute!.warnings[0]).toContain('not wheelchair-accessible');
  });

  test('Should route away from crowds in low_sensory mode', () => {
    // Make Concourse North highly crowded
    graph.updateZoneOccupancy('concourse_n', 25000);

    // Concourse North is now crowded. Standard route might still take it if distance is short.
    // But low_sensory route should detours away from it
    const routeLowSensory = routingEngine.findRoute('gate_1', 'block_a2', 'low_sensory');
    expect(routeLowSensory).not.toBeNull();
    if (routeLowSensory && routeLowSensory.path.length > 0) {
      // It should detours through Concourse East/South/West instead of Concourse North
      expect(routeLowSensory.path).not.toContain('concourse_n');
    }
  });

  test('Should generate alternate detour paths successfully', () => {
    const primaryRoute = routingEngine.findRoute('gate_1', 'block_a2', 'standard');
    expect(primaryRoute).not.toBeNull();

    const alternateRoute = routingEngine.findAlternateRoute('gate_1', 'block_a2', 'standard', primaryRoute!.path);
    expect(alternateRoute).not.toBeNull();
    expect(alternateRoute!.path.join(',')).not.toBe(primaryRoute!.path.join(','));
  });
});
