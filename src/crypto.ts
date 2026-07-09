/**
 * Encryption utilities for securing connection data
 * Uses Web Crypto API with AES-GCM
 */

const STORAGE_KEY = 'casterm-master-key';
const SALT_KEY = 'casterm-crypto-salt';

export interface EncryptedData {
  iv: string;
  data: string;
  salt: string;
}

/**
 * Generate a random salt for key derivation
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Generate a random IV for encryption
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

/**
 * Derive an encryption key from password and salt using PBKDF2
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);

  // Import password as raw key material
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordData,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-GCM key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Check if encryption is set up (master password exists)
 */
export function isEncryptionSetup(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Check if data is encrypted
 */
export function isEncrypted(data: string): boolean {
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' && 'iv' in parsed && 'data' in parsed;
  } catch {
    return false;
  }
}

/**
 * Setup encryption with a new master password
 */
export async function setupEncryption(password: string): Promise<void> {
  const salt = generateSalt();
  const saltBase64 = btoa(String.fromCharCode(...salt));
  localStorage.setItem(SALT_KEY, saltBase64);
  localStorage.setItem(STORAGE_KEY, 'true');
}

/**
 * Change master password (re-encrypts existing data)
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
  encryptedData: string
): Promise<string> {
  // Decrypt with old password
  const decrypted = await decrypt(encryptedData, oldPassword);
  if (decrypted === null) {
    throw new Error('Incorrect current password');
  }

  // Setup new encryption
  await setupEncryption(newPassword);

  // Re-encrypt with new password
  return encrypt(decrypted, newPassword);
}

/**
 * Encrypt data with password
 */
export async function encrypt(data: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const iv = generateIV();

  // Get or generate salt
  let salt: Uint8Array;
  const storedSalt = localStorage.getItem(SALT_KEY);
  if (storedSalt) {
    salt = Uint8Array.from(atob(storedSalt), c => c.charCodeAt(0));
  } else {
    salt = generateSalt();
    localStorage.setItem(SALT_KEY, btoa(String.fromCharCode(...salt)));
  }

  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encoder.encode(data)
  );

  const encryptedBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  const ivBase64 = btoa(String.fromCharCode(...iv));
  const saltBase64 = btoa(String.fromCharCode(...salt));

  return JSON.stringify({
    iv: ivBase64,
    data: encryptedBase64,
    salt: saltBase64
  });
}

/**
 * Decrypt data with password
 * Returns null if password is incorrect
 */
export async function decrypt(encryptedJson: string, password: string): Promise<string | null> {
  try {
    const encrypted: EncryptedData = JSON.parse(encryptedJson);
    const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
    const data = Uint8Array.from(atob(encrypted.data), c => c.charCodeAt(0));
    const salt = Uint8Array.from(atob(encrypted.salt), c => c.charCodeAt(0));

    const key = await deriveKey(password, salt);
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      data
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('[Crypto] Decryption failed:', error);
    return null;
  }
}

/**
 * Remove encryption (for reset/clear)
 */
export function removeEncryption(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SALT_KEY);
}

/**
 * Get encryption status
 */
export function getEncryptionStatus(): {
  setup: boolean;
  hasData: boolean;
} {
  return {
    setup: isEncryptionSetup(),
    hasData: localStorage.getItem('casterm-connections') !== null
  };
}
