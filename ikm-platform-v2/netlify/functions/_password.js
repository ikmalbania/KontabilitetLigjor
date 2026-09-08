// Password hashing using Node's built-in scrypt (a deliberately slow,
// memory-hard algorithm designed for passwords — not a plain hash like
// SHA-256, which would be too fast and unsafe for this purpose).
// No external dependency needed since scrypt ships with Node itself.

const crypto = require('crypto');

const KEY_LEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEY_LEN).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || stored.indexOf(':') === -1) return false;
  const [salt, hash] = stored.split(':');
  const candidateHash = crypto.scryptSync(password, salt, KEY_LEN);
  const storedHash = Buffer.from(hash, 'hex');
  if (candidateHash.length !== storedHash.length) return false;
  return crypto.timingSafeEqual(candidateHash, storedHash);
}

module.exports = { hashPassword, verifyPassword };
