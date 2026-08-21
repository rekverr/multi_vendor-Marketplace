import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RealtimeAccessService } from './realtime-access.service.js';
import { RealtimeAuthService } from './realtime-auth.service.js';
import { RealtimeEventsConsumer } from './realtime-events.consumer.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Module({
  imports: [AuthModule],
  providers: [
    RealtimeAuthService,
    RealtimeAccessService,
    RealtimeGateway,
    RealtimeEventsConsumer,
  ],
})
export class RealtimeModule {}
