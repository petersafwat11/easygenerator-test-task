import { ConfigService } from '@nestjs/config';
import { createApp } from './app.factory';
import type { Env } from './config/env.validation';

async function bootstrap() {
  const app = await createApp();
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  await app.listen(config.get('PORT', { infer: true }));
}
void bootstrap();
