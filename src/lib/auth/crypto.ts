import { scryptAsync } from '@noble/hashes/scrypt.js';
const hex = (v: Uint8Array) =>
  Array.from(v, (b) => b.toString(16).padStart(2, '0')).join('');
export function randomSecret() {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}
export async function digest(value: string) {
  return hex(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    ),
  );
}
export function equal(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
export async function passwordHash(password: string, salt = randomSecret()) {
  const hash = await scryptAsync(password, salt, {
    N: 16384,
    r: 8,
    p: 5,
    dkLen: 32,
    maxmem: 32 * 1024 * 1024,
  });
  return `scrypt1:${salt}:${hex(hash)}`;
}
export async function passwordMatches(password: string, stored: string) {
  const [format, salt] = stored.split(':');
  if (format !== 'scrypt1' || !salt) return false;
  return equal(await passwordHash(password, salt), stored);
}
export function validUsername(v: unknown): v is string {
  return typeof v === 'string' && /^[a-z0-9_]{3,32}$/.test(v);
}
export function validPassword(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 12 && v.length <= 128;
}
