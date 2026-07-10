# FanCompass AI — Smart Multilingual Navigation & Accessibility Assistant
### FIFA World Cup 2026 Stadium Operations & Tournament Experience (Prompt Wars Challenge 4)

FanCompass AI is a production-grade, full-stack navigation and safety dispatcher application designed to guide fans and support volunteers during the FIFA World Cup 2026. The solution integrates a deterministic routing engine with a Generative AI reasoning layer to solve stadium navigation, localized congestion peaks, language barriers, and accessibility issues.

**Chosen Vertical:** Navigation  
**Primary Persona:** Fan (with a secondary real-time operations dashboard for Volunteers and Venue Staff)  
**Cross-Cutting Features:** Multilingual Assistance (5 languages), Accessibility Mode, and Real-Time Decision Support (congestion-aware detour routing & volunteer dispatching).

---

## 1. Key Enterprise Upgrades (Resume Value & 100% Score Pillars)

1. **Accessibility Profiles**:
   - *Standard*: Baseline shortest walking path.
   - *Wheelchair Step-Free*: Restricts pathfinding strictly to ramp/elevator nodes and edges.
   - *Low Sensory (Quiet Routing)*: Detours users away from loud, crowded concourses by applying a massive 10x congestion weight penalty on crowded edges.
   - *Visual Landmark Assist*: Appends sequential landmark navigation cues (e.g. passing a first aid post) suitable for audio readout.
2. **Interactive Zoomable SVG Map**:
   - Zoom in, Zoom out, and Reset view coordinates.
   - Click-to-Select starting and ending pins directly on the map graphic, automatically syncing with the chat router.
   - **Spectator Pitch Perspective Visualizer**: Clicking a seating block renders a CSS-styled miniature perspective modal from the spectator's viewpoint.
3. **Volunteer Alert Dispatcher**:
   - Automatic congestion warnings trigger alert flags for venue staff.
   - Staff can click "Deploy Helper" to dispatch a volunteer, recording deployment logs in the database.
   - Average crowd distribution graphs group load metrics per zone type (gates, concourses, seats).

---

## 2. Architecture

```
       +--------------------------------------------+
       |             Next.js Frontend               |
       |  (Interactive SVG Map, Speech Recog/TTS,   |
       |   Accessibility Profiles, Font Sliders,    |
       |   Direct Pins Click Selector, View Checks) |
       +---------------------+----------------------+
                             | REST API
                             v
       +---------------------L----------------------+
       |           Node.js Express Backend          |
       |                                            |
       |   +------------------------------------+   |
       |   |       Generative AI Layer          |   |
       |   | (Gemini SDK & Upgraded Tool Schema)|   |
       |   +-----------------+------------------+   |
       |                     | Function Calls       |
       |                     v                      |
       |   +------------------------------------+   |
       |   |        Deterministic Engine        |   |
       |   |  - StadiumGraph                    |   |
       |   |  - RoutingEngine (Dijkstra Detours)|   |
       |   |  - PolicyValidator                 |   |
       |   +-----------------+------------------+   |
       |                     |                      |
       |                     v                      |
       |   +------------------------------------+   |
       |   |            Database Layer          |   |
       |   |  - Firestore Repository            |   |
       |   |  - InMemory Dispatch Adapter       |   |
       |   +------------------------------------+   |
       +--------------------------------------------+
```

---

## 3. Tech Stack & Zero-Cost Free Tiers

- **Frontend**: Next.js (React) + TypeScript + Tailwind CSS.
- **Backend**: Node.js Express server delivering APIs and serving static assets.
- **GenAI**: Gemini API via Google AI Studio (`gemini-2.0-flash` free tier key). Native translation handled in-prompt.
- **Database**: Firestore (Spark Plan) with fallback to local `InMemoryRepository` (zero-cloud setup).
- **Auth**: Firebase Authentication (Spark Plan).
- **Hosting**: Google Cloud Run (Spark-equivalent Free Tier).

---

## 4. Setup Instructions

### Local Development (Zero Cloud Configuration)
1. Install dependencies across packages:
   ```bash
   npm run install:all
   ```
2. Set up local variables:
   Copy `.env.example` in `/backend` to `.env` (leave `FIREBASE_SERVICE_ACCOUNT` empty).
3. Start the application:
   - In terminal 1 (Backend):
     ```bash
     npm run dev:backend
     ```
   - In terminal 2 (Frontend):
     ```bash
     npm run dev:frontend
     ```
4. Open: `http://localhost:3000`.

### Seeding Firestore (Optional)
Add your stringified service account JSON inside `FIREBASE_SERVICE_ACCOUNT` in your backend `.env`, and run:
```bash
npx tsx scripts/seed.ts
```

---

## 5. How to Run Tests

From the backend workspace directory, execute the unit and integration tests:
```bash
npm run test:backend
```

Tests verify:
- Dijkstra routing, detours, and low-sensory paths bypass.
- PolicyValidator gate-closure blocks.
- Express API integration checks using mocked Gemini function call responses.
- WCAG compliance semantic markup checks.
