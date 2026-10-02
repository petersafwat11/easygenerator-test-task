import * as argon2 from 'argon2';

// Wrap verify so the dummy path can be observed; behaviour is unchanged.
jest.mock('argon2', () => {
  const actual = jest.requireActual<typeof import('argon2')>('argon2');
  return { ...actual, verify: jest.fn(actual.verify) };
});
import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeAll(async () => {
    service = new PasswordService();
    await service.onModuleInit();
  });

  it('hashes with argon2id and the OWASP baseline parameters', async () => {
    const hash = await service.hash('abc12345!');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
  });

  it('salts every hash', async () => {
    const [a, b] = await Promise.all([
      service.hash('abc12345!'),
      service.hash('abc12345!'),
    ]);
    expect(a).not.toBe(b);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await service.hash('abc12345!');
    await expect(service.verify(hash, 'abc12345!')).resolves.toBe(true);
    await expect(service.verify(hash, 'abc12345?')).resolves.toBe(false);
  });

  it('treats passwords as exact: no trimming or case folding', async () => {
    const hash = await service.hash(' Abc12345! ');
    await expect(service.verify(hash, 'Abc12345!')).resolves.toBe(false);
    await expect(service.verify(hash, ' abc12345! ')).resolves.toBe(false);
  });

  it('dummy verification always fails but still runs argon2', async () => {
    const spy = jest.mocked(argon2.verify);
    spy.mockClear();
    await expect(service.verifyDummy('abc12345!')).resolves.toBe(false);
    expect(spy).toHaveBeenCalledWith(
      expect.stringMatching(/^\$argon2id\$/),
      'abc12345!',
    );
  });
});
