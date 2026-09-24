import * as dotenv from 'dotenv';
import * as path from 'path';

// Load root .env first (shared by all apps), then a local apps/api/.env override.
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const int = (v: string | undefined, d: number) => (v ? parseInt(v, 10) : d);

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  api: {
    port: int(process.env.API_PORT, 3000),
    prefix: process.env.API_PREFIX ?? 'api',
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://localhost:5174')
      .split(',')
      .map((s) => s.trim()),
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:5173',
  },
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: int(process.env.DB_PORT, 5432),
    user: process.env.DB_USER ?? 'sherpa',
    password: process.env.DB_PASSWORD ?? 'sherpa',
    name: process.env.DB_NAME ?? 'sherpa_lm',
    // managed providers (e.g. DigitalOcean) require TLS — enable with DB_SSL=true
    ssl: (process.env.DB_SSL ?? 'false') === 'true',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: int(process.env.REDIS_PORT, 6379),
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '900s',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },
  notify: {
    pushProvider: process.env.NOTIFY_PUSH_PROVIDER ?? 'console',
    whatsappProvider: process.env.NOTIFY_WHATSAPP_PROVIDER ?? 'console',
    fcmServerKey: process.env.FCM_SERVER_KEY ?? '',
    evolution: {
      url: process.env.EVOLUTION_API_URL ?? 'http://159.65.224.135:8080',
      key: process.env.EVOLUTION_API_KEY ?? '',
      instance: process.env.EVOLUTION_INSTANCE ?? 'pasarex',
      // shared secret required (as ?token=) on the inbound webhook Evolution calls
      webhookToken: process.env.EVOLUTION_WEBHOOK_TOKEN ?? 'dev-whatsapp-hook',
    },
  },
  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'local',
    localDir: process.env.STORAGE_LOCAL_DIR ?? './storage',
  },
  tenders: {
    // exclusive window (ms) each priority wave gets before the offer widens
    waveMs: int(process.env.TENDER_WAVE_MS, 15000),
  },
  tracking: {
    // server-side GPS simulator so the live map moves without a real device
    simulate: (process.env.TRACKING_SIMULATE ?? 'on') !== 'off',
    simIntervalMs: int(process.env.TRACKING_SIM_MS, 2500),
  },
  ocr: {
    // OpenRouter vision model used to auto-fill onboarding fields from uploaded
    // documents. Empty key => OCR is skipped gracefully (manual entry still works).
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
    baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    model: process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash-lite',
    // stronger vision model for odometer reading (falls back to the main model)
    visionModel: process.env.OPENROUTER_OCR_MODEL ?? process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash',
  },
};
