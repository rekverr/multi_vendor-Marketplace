import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis, RedisOptions } from 'ioredis';

@Injectable()
export class RedisConnectionService {
  private readonly redisUrl: string;

  constructor(config: ConfigService) {
    this.redisUrl = config.getOrThrow<string>('REDIS_URL');
  }

  createClient(options: RedisOptions = {}): Redis {
    return new Redis(this.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      ...options,
    });
  }
}
