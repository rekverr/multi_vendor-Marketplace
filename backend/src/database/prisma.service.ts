import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error('DATABASE_URL is not defined');
    }

    const databaseUrl = new URL(connectionString);
    const schema = databaseUrl.searchParams.get('schema') ?? undefined;
    databaseUrl.searchParams.delete('schema');
    const adapter = new PrismaPg(
      {
        connectionString: databaseUrl.toString(),
        options: schema ? `-c search_path=${schema}` : undefined,
      },
      schema ? { schema } : undefined,
    );

    super({ adapter });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
