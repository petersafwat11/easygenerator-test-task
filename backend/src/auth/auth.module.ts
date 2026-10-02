import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SessionsModule } from '../sessions/sessions.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionCookie } from './session-cookie';
import { SessionGuard } from './session.guard';

@Module({
  imports: [UsersModule, SessionsModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionCookie,
    // Global, deny-by-default authentication for every route.
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AuthModule {}
