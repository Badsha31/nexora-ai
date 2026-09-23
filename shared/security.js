import crypto from 'node:crypto';

export const id = () => crypto.randomUUID();

export const now = () => new Date().toISOString();

export const randomToken = (bytes = 32) =>
  crypto.randomBytes(bytes).toString('hex');

export function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 1) {
    throw new TypeError('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  try {
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    if (!salt.length || !expected.length) return false;

    const actual = crypto.scryptSync(password, salt, expected.length);
    return actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function decrypt(ciphertext, iv, tag, secret) {
  if (typeof secret !== 'string' || secret.length < 16) throw new TypeError('Encryption secret is too short');
  const key = crypto.createHash('sha256').update(secret).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'hex')), decipher.final()]).toString('utf8');
}

export function hashSecret(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
