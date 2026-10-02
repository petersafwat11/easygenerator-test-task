import { HttpStatus, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppError } from '../common/errors/app-error';
import { isDuplicateKeyError } from '../common/errors/db-errors';
import { ErrorCode } from '../common/errors/error-codes';
import { User, UserRecord } from './schemas/user.schema';

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
}

const PUBLIC_FIELDS = '_id email name createdAt';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  /** Startup waits until the unique email index exists, so no request can race it. */
  async onModuleInit(): Promise<void> {
    await this.users.init();
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    try {
      const created = await this.users.create(input);
      return {
        _id: created._id,
        email: created.email,
        name: created.name,
        createdAt: created.createdAt,
      };
    } catch (error) {
      // Only a duplicate on the email index means "taken"; anything else is a real failure.
      if (isDuplicateKeyError(error, 'email')) {
        throw new AppError(HttpStatus.CONFLICT, ErrorCode.EMAIL_TAKEN);
      }
      throw error;
    }
  }

  findById(id: Types.ObjectId): Promise<UserRecord | null> {
    return this.users.findById(id, PUBLIC_FIELDS).lean<UserRecord>().exec();
  }

  findByEmailWithPassword(
    email: string,
  ): Promise<(UserRecord & { passwordHash: string }) | null> {
    return this.users
      .findOne({ email }, `${PUBLIC_FIELDS} +passwordHash`)
      .lean<UserRecord & { passwordHash: string }>()
      .exec();
  }
}
