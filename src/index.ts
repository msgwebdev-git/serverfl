import express from 'express';
import cors from 'cors';
import { config, validateConfig } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

// Routes
import healthRoutes from './routes/health.js';
import checkoutRoutes from './routes/checkout.js';
import promoRoutes from './routes/promo.js';
import webhookRoutes from './routes/webhook.js';
import adminRoutes from './routes/admin.js';
import b2bRoutes from './routes/b2b.js';

// Cron jobs
import { initCronJobs } from './services/cron.js';

// Validate config
validateConfig();

const app = express();

// CORS
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

// Parse JSON (except for webhooks which need raw body)
app.use('/api/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// Request logging
app.use(requestLogger);

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/promo', promoRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/b2b', b2bRoutes);

// Error handler
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`🚀 Server running on port ${config.port}`);
  console.log(`📍 Environment: ${config.nodeEnv}`);
  console.log(`🌐 Frontend URL: ${config.frontendUrl}`);

  // Initialize cron jobs
  if (config.cron.enabled) {
    initCronJobs();
    console.log('⏰ Cron jobs initialized');
  }
});

export default app;
