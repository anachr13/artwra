import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import sessionRoutes from './routes/sessions';
import mediaRoutes from './routes/media';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT ?? 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/media', mediaRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    data: null,
    error: { message: 'Route not found', code: 'NOT_FOUND' },
  });
});

// Global error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[API] Server running on port ${PORT} in ${process.env.NODE_ENV ?? 'development'} mode`);
});

export default app;
