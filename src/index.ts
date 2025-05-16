import express, { ErrorRequestHandler } from 'express';
import RateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import dotenv from 'dotenv';
import logger from 'morgan';
import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import CookieParser from 'cookie-parser';
import path from 'path';
import multer from 'multer';
import UserRoutes from './routes/UserRoutes';
import AuthRoutes from './routes/AuthRoutes';
import GenericRoutes from './routes/GenericRoutes';
import VesselRoutes from './routes/VesselRoutes';
import PinRoutes from './routes/PinRoutes';
import LocationRoutes from './routes/LocationRoutes';
import SubLocationRoutes from './routes/SubLocationRoutes';
import EquipmentRoutes from './routes/EquipmentRoutes';
import ObjectRoutes from './routes/ObjectRoutes';
import CompartmentRoutes from './routes/CompartmentRoutes';
import DocumentTypeRoutes from './routes/DocumentTypeRoutes';
import InventoryRoutes from './routes/InventoryRoutes';
import LocationDiagramRoutes from './routes/LocationDiagramRoutes';

dotenv.config();

const app = express();
app.use(CookieParser());

const corsOptions: CorsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.static('public'));
app.use(logger('dev'));
app.use(helmet());
app.use(express.json());

// const uploadsPath = path.join(__dirname, '../uploads');
// app.use('/uploads', express.static(uploadsPath));

const limit = RateLimit({
  windowMs: 60 * 1000,
  max: 60,
});

app.use('/api/', limit);
app.use('/api/users', UserRoutes);
app.use('/api/auth', AuthRoutes);
app.use('/api/vessels', VesselRoutes);
app.use('/api/pins', PinRoutes);
app.use('/api/locations', LocationRoutes);
app.use('/api/sub-locations', SubLocationRoutes);
app.use('/api/equipments', EquipmentRoutes);
app.use('/api/objects', ObjectRoutes);
app.use('/api/compartments', CompartmentRoutes);
app.use('/api/document-types', DocumentTypeRoutes);
app.use('/api/inventory', InventoryRoutes);
app.use('/api/generics', GenericRoutes);
app.use('/api/location-diagrams', LocationDiagramRoutes);

// Multer error handling middleware
const multerErrorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: 'File upload error',
      error: err.message,
      code: err.code
    });
  }
  next(err);
};

app.use(multerErrorHandler);

// Improved error handler with detailed logging
const fallback: ErrorRequestHandler = (err, req, res, _next) => {
  console.error('Server error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
  });
  res.status(500).json({ success: false, message: err.message });
};

app.use(fallback);

const PORT = process.env.APP_PORT ?? 3005;

const server = createServer(app);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});