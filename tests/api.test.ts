import request from 'supertest';
import express from 'express';
import apiRouter from '../backend/src/routes/routes.js';
import * as gemini from '../backend/src/ai/gemini.js';

// Mock gemini client calls
jest.mock('../backend/src/ai/gemini.js', () => ({
  askGemini: jest.fn().mockImplementation((query, graph, profile, language) => {
    return Promise.resolve({
      answer: `Mocked guidance for query: ${query} in ${language} using ${profile}`,
      routeResult: {
        path: ['gate_1', 'concourse_n', 'block_a2'],
        waypoints: [],
        totalDistance: 195,
        estimatedTimeMin: 3,
        averageCongestion: 0.1,
        warnings: []
      },
      alternateRouteResult: {
        path: ['gate_1', 'concourse_e', 'block_b2', 'block_a2'],
        waypoints: [],
        totalDistance: 310,
        estimatedTimeMin: 5,
        averageCongestion: 0.05,
        warnings: []
      },
      toolCalled: 'getRoute',
      toolArgs: { fromId: 'gate_1', toId: 'block_a2', profile }
    });
  })
}));

const app = express();
app.use(express.json());
app.use('/api', apiRouter);

describe('API Route Handler Upgraded Tests', () => {
  test('GET /api/stadium should fetch default zones and edges', async () => {
    const res = await request(app).get('/api/stadium');
    expect(res.status).toBe(200);
    expect(res.body.zones).toBeDefined();
    expect(res.body.edges).toBeDefined();
  });

  test('POST /api/ask should return mocked Gemini recommendations with detour options', async () => {
    const res = await request(app)
      .post('/api/ask')
      .send({
        query: 'Route Gate 1 to Block A2',
        language: 'English',
        accessibilityProfile: 'low_sensory'
      });
    
    expect(res.status).toBe(200);
    expect(res.body.answer).toContain('using low_sensory');
    expect(res.body.routeResult).toBeDefined();
    expect(res.body.alternateRouteResult).toBeDefined();
  });

  test('POST /api/admin/dispatch should register a volunteer helper deployment', async () => {
    const res = await request(app)
      .post('/api/admin/dispatch')
      .set('Authorization', 'Bearer volunteer-demo-token-123')
      .send({ zoneId: 'gate_1' });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.dispatch.zoneId).toBe('gate_1');
  });

  test('GET /api/admin/dispatches should retrieve recent deployments', async () => {
    const res = await request(app)
      .get('/api/admin/dispatches')
      .set('Authorization', 'Bearer volunteer-demo-token-123');
    
    expect(res.status).toBe(200);
    expect(res.body.dispatches).toBeDefined();
    expect(res.body.dispatches.length).toBeGreaterThan(0);
  });
});
