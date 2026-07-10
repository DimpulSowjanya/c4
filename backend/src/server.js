import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/routes.js';

// Setup environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// API Namespace
app.use('/api', apiRouter);

// Resolve directories for static files (Frontend builds)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In a unified container build, Next.js static files can be served from here
const clientBuildPath = path.join(__dirname, '../../frontend/out');
app.use(express.static(clientBuildPath));

// Fallback all non-API paths to serve Next.js single-page application index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Run server
app.listen(PORT, () => {
  console.log(`FanCompass AI Server is running on port ${PORT}`);
  console.log(`Database adapter loaded in: ${process.env.FIREBASE_SERVICE_ACCOUNT ? 'Firestore mode' : 'Local In-Memory fallback'}`);
});
