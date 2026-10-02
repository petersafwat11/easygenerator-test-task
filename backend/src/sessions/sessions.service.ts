import { createHash, randomBytes } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Env } from '../config/env.validation';
import { Session, SessionRecord } from './schemas/session.schema';

/** 32 random bytes as base64url: always 43 characters from this alphabet. */
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

export interface NewSession {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class SessionsService implements OnModuleInit {
  private readonly ttlMs: number;

  constructor(
    @InjectModel(Session.name) private readonly sessions: Model<Session>,
    config: ConfigService<Env, true>,
  ) {
    this.ttlMs = config.get('SESSION_TTL_SECONDS', { infer: true }) * 1000;
  }

  async onModuleInit(): Promise<void> {
    await this.sessions.init();
  }

  /** Cheap pre-check so malformed cookies never reach the database. */
  static isWellFormed(token: string | undefined): token is string {
    return token !== undefined && TOKEN_FORMAT.test(token);
  }

  /**
   * The token has 256 bits of entropy, so a fast hash is enough: brute force is
   * impossible, and a leaked sessions collection yields no usable cookies.
   */
  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(userId: Types.ObjectId): Promise<NewSession> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + this.ttlMs);
    await this.sessions.create({
      tokenHash: SessionsService.hashToken(token),
      userId,
      expiresAt,
    });
    return { token, expiresAt };
  }

  /** A session that exists and has not expired. Fixed lifetime: reading never extends it. */
  findValid(token: string): Promise<SessionRecord | null> {
    return this.sessions
      .findOne(
        {
          tokenHash: SessionsService.hashToken(token),
          expiresAt: { $gt: new Date() },
        },
        '_id userId expiresAt',
      )
      .lean<SessionRecord>()
      .exec();
  }

  async deleteByToken(token: string): Promise<void> {
    await this.sessions
      .deleteOne({ tokenHash: SessionsService.hashToken(token) })
      .exec();
  }
}
