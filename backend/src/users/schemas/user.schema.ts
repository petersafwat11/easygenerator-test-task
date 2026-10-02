import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument, Types } from 'mongoose';

@Schema({ collection: 'users', timestamps: true })
export class User {
  /** Stored normalized (trimmed, lowercased). Uniqueness is enforced by this index, not a pre-check. */
  @Prop({ required: true, unique: true })
  email!: string;

  @Prop({ required: true })
  name!: string;

  /** Never returned unless explicitly selected. */
  @Prop({ required: true, select: false })
  passwordHash!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type UserDocument = HydratedDocument<User>;

/** A user as read from the database (lean), without the password hash. */
export interface UserRecord {
  _id: Types.ObjectId;
  email: string;
  name: string;
  createdAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
