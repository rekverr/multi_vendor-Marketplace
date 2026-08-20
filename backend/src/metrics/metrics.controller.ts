import {
  Controller,
  Get,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { MetricsService } from './metrics.service.js';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
  ) {}

  @Get()
  async metrics(
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    response.setHeader(
      'Content-Type',
      this.metricsService.contentType,
    );

    return this.metricsService.getMetrics();
  }
}