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

  JWT_REFRESH_TTL_SECONDS: Joi.number()
    .integer()
    .positive()
    .default(2592000),

  JWT_ISSUER: Joi.string().min(1).default('marketplace-api'),

  JWT_AUDIENCE: Joi.string().min(1).default('marketplace-client'),

  REDIS_URL: Joi.string()
    .pattern(/^redis(s)?:\/\//)
    .required(),

  MEILI_HOST: Joi.string().uri().required(),

  MEILI_MASTER_KEY: Joi.string().min(8).required(),
});
