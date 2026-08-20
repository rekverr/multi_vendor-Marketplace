import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),

  PORT: Joi.number().port().default(3000),

  CORS_ORIGIN: Joi.string().uri().required(),

  DATABASE_URL: Joi.string()
    .pattern(/^postgres(ql)?:\/\//)
    .required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),

  JWT_ACCESS_TTL_SECONDS: Joi.number().integer().positive().default(900),

  JWT_REFRESH_TTL_SECONDS: Joi.number().integer().positive().default(2592000),

  JWT_ISSUER: Joi.string().min(1).default('marketplace-api'),

  JWT_AUDIENCE: Joi.string().min(1).default('marketplace-client'),

  GOOGLE_OAUTH_CLIENT_ID: Joi.string().min(1).required(),

  GOOGLE_OAUTH_CLIENT_SECRET: Joi.string().min(1).required(),

  GOOGLE_OAUTH_REDIRECT_URI: Joi.string().uri().required(),

  GOOGLE_OAUTH_STATE_TTL_SECONDS: Joi.number()
    .integer()
    .positive()
    .max(900)
    .default(600),

  REDIS_URL: Joi.string()
    .pattern(/^redis(s)?:\/\//)
    .required(),

  OUTBOX_POLL_INTERVAL_MS: Joi.number().integer().min(100).default(1000),

  OUTBOX_BATCH_SIZE: Joi.number().integer().positive().max(100).default(25),

  OUTBOX_LEASE_MS: Joi.number().integer().min(1000).default(30000),

  OUTBOX_PUBLISHER_ENABLED: Joi.boolean()
    .truthy('true')
    .falsy('false')
    .default(true),

  PLATFORM_COMMISSION_RATE: Joi.string()
    .pattern(/^(?:0(?:\.\d{1,6})?|1(?:\.0{1,6})?)$/)
    .default('0.100000'),

  ORDER_CURRENCY: Joi.string()
    .pattern(/^[A-Z]{3}$/)
    .default('USD'),

  MEILI_HOST: Joi.string().uri().required(),

  MEILI_MASTER_KEY: Joi.string().min(8).required(),
});
