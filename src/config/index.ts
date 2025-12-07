import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, ''),
  apiUrl: (process.env.API_URL || 'http://localhost:3001').replace(/\/$/, ''),

  // Supabase
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },

  // MAIB Payment Gateway (REST API)
  maib: {
    mockMode: process.env.MAIB_MOCK_MODE === 'true', // For testing without real MAIB
    projectId: process.env.MAIB_PROJECT_ID || '',
    projectSecret: process.env.MAIB_PROJECT_SECRET || '',
    signatureKey: process.env.MAIB_SIGNATURE_KEY || '',
    baseUrl: process.env.MAIB_BASE_URL || 'https://api.maibmerchants.md/v1',
    currency: 'MDL',
  },

  // Email
  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'tickets@festival.com',
  },

  // Cron Jobs
  cron: {
    enabled: process.env.ENABLE_CRON_JOBS === 'true',
    firstReminderHours: parseInt(process.env.FIRST_REMINDER_HOURS || '1', 10),
    secondReminderHours: parseInt(process.env.SECOND_REMINDER_HOURS || '24', 10),
    pendingExpireHours: parseInt(process.env.PENDING_ORDER_EXPIRE_HOURS || '72', 10),
  },
} as const;

// Validate required config in production
export function validateConfig(): void {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'MAIB_PROJECT_ID',
    'MAIB_PROJECT_SECRET',
    'MAIB_SIGNATURE_KEY',
    'RESEND_API_KEY',
  ];

  if (config.nodeEnv === 'production') {
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
}
