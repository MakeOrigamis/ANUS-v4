import crypto from 'crypto';
import { logWarn } from './logger';

const IV_LENGTH = 16;
const ALGORITHM = 'aes-256-cbc';
const REQUIRED_KEY_LENGTH = 32; // AES-256 requires 32 bytes

// ═══════════════════════════════════════════════════════════════════════════════
// ENCRYPTION KEY VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validates the ENCRYPTION_KEY environment variable
 * Throws an error if the key is missing or invalid
 */
function validateEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;

  // Check if key exists
  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY is required but not set in environment variables.\n' +
      'Please set ENCRYPTION_KEY in your .env.local file.\n' +
      'The key must be exactly 32 characters long for AES-256 encryption.\n' +
      'Example: ENCRYPTION_KEY="your-32-character-encryption-key!!"'
    );
  }

  // Check key length (must be exactly 32 bytes for AES-256)
  const keyBuffer = Buffer.from(key, 'utf8');
  if (keyBuffer.length !== REQUIRED_KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly ${REQUIRED_KEY_LENGTH} bytes (characters) long.\n` +
      `Current length: ${keyBuffer.length} bytes.\n` +
      `Please generate a new key with exactly ${REQUIRED_KEY_LENGTH} characters.\n` +
      'You can generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // Warn if key looks like default/weak
  if (key === 'default-32-char-encryption-key!!' || key.length < 20) {
    logWarn('ENCRYPTION_KEY appears to be weak or default. Please use a strong, randomly generated key for production use.');
  }

  return key;
}

// Validate encryption key on module load (fails fast if invalid)
const ENCRYPTION_KEY = validateEncryptionKey();

/**
 * Encrypts a string using AES-256-CBC
 * Used for securing private keys before database storage
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts a string that was encrypted with the encrypt function
 */
export function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

