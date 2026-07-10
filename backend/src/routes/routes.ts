import { Router, Request, Response } from 'express';
import { StadiumGraph } from '../services/StadiumGraph.js';
import { askGemini } from '../ai/gemini.js';
import { InMemoryRepository, FirestoreRepository, DatabaseRepository } from '../db/db.js';
import { askRateLimiter, validateInput, requireStaffAuth } from '../middleware/security.js';

const router = Router();
const stadiumGraph = new StadiumGraph();

const hasFirebase = !!process.env.FIREBASE_SERVICE_ACCOUNT;
export const dbRepository: DatabaseRepository = hasFirebase
  ? new FirestoreRepository()
  : new InMemoryRepository(stadiumGraph);

async function syncGraphState() {
  try {
    const dbZones = await dbRepository.getZones();
    if (dbZones.length > 0) {
      for (const zone of dbZones) {
        stadiumGraph.updateZoneStatus(zone.id, zone.status);
        stadiumGraph.updateZoneOccupancy(zone.id, zone.currentOccupancy);
      }
    }
  } catch (error) {
    console.error('Error syncing graph with database:', error);
  }
}

syncGraphState();

router.get('/stadium', async (req: Request, res: Response) => {
  try {
    await syncGraphState();
    const zones = stadiumGraph.getAllZones();
    const edges = await dbRepository.getEdges();
    const amenities = await dbRepository.getAmenities();
    
    res.json({ zones, edges, amenities });
  } catch (error) {
    console.error('Error fetching stadium data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/ask', askRateLimiter, validateInput, async (req: Request, res: Response) => {
  try {
    const { sanitizedQuery, accessibilityProfile, language } = req.body;
    
    await syncGraphState();

    const targetLang = language || 'English';
    const activeProfile = accessibilityProfile || 'standard';

    const response = await askGemini(sanitizedQuery, stadiumGraph, activeProfile, targetLang);

    // Save query logs
    await dbRepository.logQuery({
      timestampUTC: new Date().toISOString(),
      languageDetected: targetLang,
      intentSummary: response.toolCalled ? `Invoked ${response.toolCalled} (${activeProfile})` : 'General Inquiry',
      routeGiven: JSON.stringify({
        path: response.routeResult?.path || [],
        totalDistance: response.routeResult?.totalDistance || 0,
        estimatedTimeMin: response.routeResult?.estimatedTimeMin || 0,
        warnings: response.routeResult?.warnings || [],
        hasAlternateRoute: !!response.alternateRouteResult
      }),
      anonymized: true
    });

    res.json(response);
  } catch (error) {
    console.error('Error handling /ask request:', error);
    res.status(500).json({ error: 'Internal server error processing prompt.' });
  }
});

router.post('/admin/toggle-gate', requireStaffAuth, async (req: Request, res: Response) => {
  try {
    const { zoneId, status } = req.body;

    if (!zoneId || !['open', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid arguments. zoneId and status ("open" | "closed") are required.' });
    }

    const updated = await dbRepository.updateZoneStatus(zoneId, status);
    if (updated) {
      stadiumGraph.updateZoneStatus(zoneId, status);
      res.json({ success: true, message: `Zone ${zoneId} is now ${status}.` });
    } else {
      res.status(404).json({ error: 'Zone not found.' });
    }
  } catch (error) {
    console.error('Error toggling zone status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/occupancy', requireStaffAuth, async (req: Request, res: Response) => {
  try {
    const { zoneId, occupancy } = req.body;

    if (!zoneId || occupancy === undefined || typeof occupancy !== 'number') {
      return res.status(400).json({ error: 'Invalid arguments. zoneId and occupancy (number) are required.' });
    }

    const updated = await dbRepository.updateZoneOccupancy(zoneId, occupancy);
    if (updated) {
      stadiumGraph.updateZoneOccupancy(zoneId, occupancy);
      res.json({ success: true, message: `Occupancy for ${zoneId} updated to ${occupancy}.` });
    } else {
      res.status(404).json({ error: 'Zone not found.' });
    }
  } catch (error) {
    console.error('Error updating occupancy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/admin/queries-log', requireStaffAuth, async (req: Request, res: Response) => {
  try {
    const logs = await dbRepository.getQueryLogs();
    res.json({ logs });
  } catch (error) {
    console.error('Error fetching query logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Endpoint: /api/admin/dispatch
 * Records a volunteer dispatch helper assignment. (Admin/Staff only)
 */
router.post('/admin/dispatch', requireStaffAuth, async (req: Request, res: Response) => {
  try {
    const { zoneId } = req.body;
    if (!zoneId) {
      return res.status(400).json({ error: 'zoneId is required' });
    }

    const dispatch = await dbRepository.dispatchVolunteer(zoneId);
    res.json({ success: true, dispatch });
  } catch (error) {
    console.error('Error dispatching volunteer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Endpoint: /api/admin/dispatches
 * Fetches all registered dispatches. (Admin/Staff only)
 */
router.get('/admin/dispatches', requireStaffAuth, async (req: Request, res: Response) => {
  try {
    const dispatches = await dbRepository.getDispatches();
    res.json({ dispatches });
  } catch (error) {
    console.error('Error fetching dispatches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
