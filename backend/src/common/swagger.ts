import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SESSION_COOKIE_SECURITY = 'session';
export const DOCS_PATH = 'api/docs';

/** Swagger UI at /api/docs. Called only outside production. */
export function setupSwagger(app: INestApplication, version: string): void {
  const config = new DocumentBuilder()
    .setTitle('Easygenerator Auth API')
    .setDescription(
      [
        'Sign up, sign in, the current user and logout.',
        '',
        'Authentication is an opaque, httpOnly session cookie (`session` in development, `__Host-session` in production) set by signup/signin. Swagger UI sends it automatically once you have signed in from this page.',
        '',
        'Every mutation must be `Content-Type: application/json`. Errors share one shape (`ErrorResponseDto`).',
      ].join('\n'),
    )
    .setVersion(version)
    .addCookieAuth(
      'session',
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'session',
        description: 'Opaque session token (httpOnly; set by signup/signin).',
      },
      SESSION_COOKIE_SECURITY,
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(DOCS_PATH, app, document, {
    swaggerOptions: { withCredentials: true },
  });
}
