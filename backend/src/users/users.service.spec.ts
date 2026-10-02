import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import { AppError } from '../common/errors/app-error';
import type { User } from './schemas/user.schema';
import { UsersService } from './users.service';

function duplicateKeyError(keyPattern: Record<string, number>) {
  return Object.assign(new Error('E11000 duplicate key error'), {
    name: 'MongoServerError',
    code: 11000,
    keyPattern,
  });
}

describe('UsersService.create', () => {
  const input = { email: 'a@b.co', name: 'Ada', passwordHash: 'hash' };

  function serviceWith(create: jest.Mock): UsersService {
    return new UsersService({ create } as unknown as Model<User>);
  }

  it('returns the public fields of the created user', async () => {
    const _id = new Types.ObjectId();
    const createdAt = new Date();
    const service = serviceWith(
      jest.fn().mockResolvedValue({ _id, ...input, createdAt }),
    );
    await expect(service.create(input)).resolves.toEqual({
      _id,
      email: 'a@b.co',
      name: 'Ada',
      createdAt,
    });
  });

  it('maps a duplicate key on email to 409 EMAIL_TAKEN', async () => {
    const service = serviceWith(
      jest.fn().mockRejectedValue(duplicateKeyError({ email: 1 })),
    );
    const error = await service.create(input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).getStatus()).toBe(409);
    expect((error as AppError).code).toBe('EMAIL_TAKEN');
  });

  it('does not map a duplicate key on another index', async () => {
    const original = duplicateKeyError({ other: 1 });
    const service = serviceWith(jest.fn().mockRejectedValue(original));
    await expect(service.create(input)).rejects.toBe(original);
  });

  it('passes other database errors through untouched', async () => {
    const original = Object.assign(new Error('down'), {
      name: 'MongoServerSelectionError',
    });
    const service = serviceWith(jest.fn().mockRejectedValue(original));
    await expect(service.create(input)).rejects.toBe(original);
  });
});
