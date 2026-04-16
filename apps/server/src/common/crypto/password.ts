import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const KEY_LENGTH = 64;
const HASH_SCHEME = 'scrypt';
const SALT_LENGTH = 16;
const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  return `${HASH_SCHEME}$${salt}$${derivedKey.toString('hex')}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [scheme, salt, hashHex] = storedHash.split('$');
  if (scheme !== HASH_SCHEME || !salt || !hashHex) {
    return false;
  }

  const expectedHash = Buffer.from(hashHex, 'hex');
  const actualHash = (await scryptAsync(password, salt, expectedHash.length)) as Buffer;

  return timingSafeEqual(actualHash, expectedHash);
}
