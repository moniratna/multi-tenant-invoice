export default () => ({
  port: 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    name: process.env.DB_NAME || 'invoice_reconciliation',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  ai: {
    provider: process.env.AI_PROVIDER || 'mock',
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  },
  pythonBackend: {
    url: process.env.PYTHON_BACKEND_URL || 'http://localhost:8000',
  },
  idempotency: {
    ttlHours: process.env.IDEMPOTENCY_KEY_TTL_HOURS || 24,
  },
});
