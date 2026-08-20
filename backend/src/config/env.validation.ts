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

  REDIS_URL: Joi.string()
    .pattern(/^redis(s)?:\/\//)
    .required(),

  MEILI_HOST: Joi.string().uri().required(),

  MEILI_MASTER_KEY: Joi.string().min(8).required(),
});
