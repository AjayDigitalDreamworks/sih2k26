import dotenv from 'dotenv';
import path from 'path';
// Load .env from cwd as well as relative directory structures
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export const env = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  postgresUri: process.env.POSTGRES_URI || '',
  mongoUri: process.env.MONGO_URI || '',
  redisUrl: process.env.REDIS_URL || '',
  upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL || '',
  upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'fallback_access_secret',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback_another_secret',
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || '1d',
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8010',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  coreBackendInternalKey: process.env.CORE_BACKEND_INTERNAL_KEY || '',
  imdApiKey: process.env.IMD_API_KEY || '',
  imdJwtToken: process.env.IMD_JWT_TOKEN || '',
  imdBaseUrl: process.env.IMD_BASE_URL || 'https://api.imd.gov.in/api/v1',
  imdIntegrationEnabled: (process.env.IMD_INTEGRATION_ENABLED || 'true').toLowerCase() === 'true',
  tomtomApiKey: process.env.TOMTOM_API_KEY || '',
};
