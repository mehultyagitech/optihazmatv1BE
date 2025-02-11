import express, { ErrorRequestHandler } from 'express';
import RateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import dotenv from 'dotenv';
import logger from 'morgan';
import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import CookieParser from 'cookie-parser';
import UserRoutes from './routes/UserRoutes';
import AuthRoutes from './routes/AuthRoutes';

dotenv.config();

const app = express();
app.use(CookieParser());

const corsOptions: CorsOptions = {
  origin: 'http://localhost:5173',
  credentials: true,
};

app.use(logger('dev'));
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());

const limit = RateLimit({
  windowMs: 60 * 1000,
  max: 60,
});

app.use('/api/', limit);
app.use('/api/users', UserRoutes);
app.use('/api/auth', AuthRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const fallback: ErrorRequestHandler = (err, _req, res, _next) => {
  res.status(500).json({ success: false, message: err.message });
};

app.use(fallback);

const PORT = process.env.APP_PORT ?? 3005;

const server = createServer(app);


server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});