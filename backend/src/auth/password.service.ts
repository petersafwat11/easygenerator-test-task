import { randomBytes } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';

/** OWASP baseline for argon2id: 19 MiB memory, 2 iterations, 1 lane. */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash!: string;

  /** Precomputed once so unknown-email sign-ins pay a comparable verify cost. */
  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hash(randomBytes(32).toString('base64url'));
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  /**
   * Burns one verification against the dummy hash and always fails. This narrows,
   * but does not eliminate, the timing gap between "no such user" and "wrong password".
   */
  async verifyDummy(password: string): Promise<false> {
    await argon2.verify(this.dummyHash, password);
    return false;
  }
}
