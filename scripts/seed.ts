import * as admin from 'firebase-admin';
import { StadiumGraph } from '../backend/src/services/StadiumGraph.js';
import { Amenity } from '../backend/src/db/db.js';

// Load env variables
import * as dotenv from 'dotenv';
dotenv.config();

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.log('No FIREBASE_SERVICE_ACCOUNT environment variable found. Please check your credentials file or skip seeding Firestore.');
  process.exit(0);
}

try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT or initialize Admin SDK:', error);
  process.exit(1);
}

const db = admin.firestore();
const STADIUM_ID = 'world_cup_stadium_2026';

async function seedStadium() {
  console.log('Seeding Firestore Database...');

  const graph = new StadiumGraph();
  const zones = graph.getAllZones();

  // Gather edges
  const edgesMap = new Map<string, any>();
  for (const zone of zones) {
    const neighbors = graph.getNeighbors(zone.id);
    for (const edge of neighbors) {
      // Sort IDs to avoid duplicating undirected paths in seed
      const canonicalKey = [edge.fromZoneId, edge.toZoneId].sort().join('_');
      edgesMap.set(canonicalKey, edge);
    }
  }
  const edges = Array.from(edgesMap.values());

  // Define amenities
  const amenities: Amenity[] = [
    { id: 'amenity_restroom_1', zoneId: 'amenity_restroom_1', type: 'restroom', accessible: false },
    { id: 'amenity_restroom_acc_1', zoneId: 'amenity_restroom_acc_1', type: 'restroom', accessible: true },
    { id: 'amenity_medical_1', zoneId: 'amenity_medical_1', type: 'medical', accessible: true },
    { id: 'amenity_prayer_1', zoneId: 'amenity_prayer_1', type: 'prayer', accessible: true },
    { id: 'amenity_family_1', zoneId: 'amenity_family_1', type: 'family', accessible: true },
    { id: 'amenity_food_1', zoneId: 'amenity_food_1', type: 'food', accessible: false }
  ];

  const stadiumRef = db.collection('stadiums').doc(STADIUM_ID);
  
  // Set stadium main document
  await stadiumRef.set({
    name: 'FIFA World Cup 2026 Stadium (Seeded)',
    location: 'North America',
    capacity: 80000
  });

  // Seed Zones
  console.log(`Writing ${zones.length} zones...`);
  const zoneBatch = db.batch();
  for (const zone of zones) {
    const zoneRef = stadiumRef.collection('zones').doc(zone.id);
    zoneBatch.set(zoneRef, {
      name: zone.name,
      type: zone.type,
      stepFree: zone.stepFree,
      status: zone.status,
      capacity: zone.capacity,
      currentOccupancy: zone.currentOccupancy,
      x: zone.x,
      y: zone.y
    });
  }
  await zoneBatch.commit();

  // Seed Edges
  console.log(`Writing ${edges.length} edges...`);
  const edgeBatch = db.batch();
  for (const edge of edges) {
    const edgeRef = stadiumRef.collection('edges').doc(edge.id);
    edgeBatch.set(edgeRef, {
      fromZoneId: edge.fromZoneId,
      toZoneId: edge.toZoneId,
      distanceMeters: edge.distanceMeters,
      stepFree: edge.stepFree
    });
  }
  await edgeBatch.commit();

  // Seed Amenities
  console.log(`Writing ${amenities.length} amenities...`);
  const amenityBatch = db.batch();
  for (const amenity of amenities) {
    const amenityRef = stadiumRef.collection('amenities').doc(amenity.id);
    amenityBatch.set(amenityRef, {
      zoneId: amenity.zoneId,
      type: amenity.type,
      accessible: amenity.accessible
    });
  }
  await amenityBatch.commit();

  console.log('Firestore seed completed successfully!');
}

seedStadium().catch(err => {
  console.error('Error seeding database:', err);
  process.exit(1);
});
