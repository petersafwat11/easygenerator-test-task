import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../common/decorators/public.decorator';
import type { Env } from '../config/env.validation';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly mongoose: MongooseHealthIndicator,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Process is up. Reports the deployed commit so CD can confirm the new version is serving. */
  @Get('live')
  live(): { status: 'ok'; version: string } {
    return {
      status: 'ok',
      version: this.config.get('GIT_SHA', { infer: true }),
    };
  }

  /** Ready to serve traffic: the database answers a ping. */
  @Get('ready')
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.mongoose.pingCheck('mongodb', { timeout: 1500 }),
    ]);
  }
}
