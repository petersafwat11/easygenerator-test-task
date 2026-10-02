import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

@Schema({
  collection: 'sessions',
  timestamps: { createdAt: true, updatedAt: false },
})
export class Session {
  /** SHA-256 of the cookie token. The token itself is never stored. */
  @Prop({ required: true, unique: true })
  tokenHash!: string;

  /** Indexed so "log out everywhere" is a single deleteMany later. */
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  expiresAt!: Date;

  createdAt!: Date;
}

export interface SessionRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  expiresAt: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Cleanup only: Mongo's TTL monitor runs about once a minute, so queries check
// expiresAt themselves and a session dies on time regardless.
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
