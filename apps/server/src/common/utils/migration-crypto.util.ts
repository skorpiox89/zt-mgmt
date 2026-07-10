import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';

const ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const KDF = 'scrypt';
const SALT_LENGTH = 16;
const scryptAsync = promisify(scrypt);

export interface EncryptedMigrationPayload {
  algorithm: typeof ALGORITHM;
  authTag: string;
  ciphertext: string;
  iv: string;
  kdf: typeof KDF;
  salt: string;
}

async function deriveKey(password: string, salt: Buffer) {
  return (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
}

export async function encryptMigrationPayload(value: string, password: string) {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = await deriveKey(password, salt);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);

  return {
    algorithm: ALGORITHM,
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    kdf: KDF,
    salt: salt.toString('base64'),
  } satisfies EncryptedMigrationPayload;
}

export async function decryptMigrationPayload(
  payload: EncryptedMigrationPayload,
  password: string,
) {
  if (payload.algorithm !== ALGORITHM || payload.kdf !== KDF) {
    throw new Error('不支持的迁移包加密格式');
  }

  const authTag = Buffer.from(payload.authTag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');
  const iv = Buffer.from(payload.iv, 'base64');
  const salt = Buffer.from(payload.salt, 'base64');

  if (
    authTag.length !== AUTH_TAG_LENGTH ||
    iv.length !== IV_LENGTH ||
    salt.length !== SALT_LENGTH
  ) {
    throw new Error('迁移包加密数据无效');
  }

  const key = await deriveKey(password, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return plaintext.toString('utf8');
}
