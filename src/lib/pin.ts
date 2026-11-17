import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const PIN_HASH_KEY = 'dumpit.pin.hash.v1';
const LOCK_ENABLED_KEY = 'dumpit.lock.enabled';

export async function getStoredPinHash(): Promise<string | null> {
  return SecureStore.getItemAsync(PIN_HASH_KEY).catch(() => null);
}

export async function isLockEnabled(): Promise<boolean> {
  if (!(await getStoredPinHash())) return false;
  return (await SecureStore.getItemAsync(LOCK_ENABLED_KEY).catch(() => '0')) === '1';
}

async function hash(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `dumpit:${pin}`);
}

export async function setPin(pin: string): Promise<boolean> {
  if (pin.length < 4) return false;
  await SecureStore.setItemAsync(PIN_HASH_KEY, await hash(pin));
  await SecureStore.setItemAsync(LOCK_ENABLED_KEY, '1');
  return true;
}

export async function clearPin(pin: string): Promise<boolean> {
  const stored = await getStoredPinHash();
  if (!stored) return true;
  const ok = (await hash(pin)) === stored;
  if (ok) {
    await SecureStore.deleteItemAsync(PIN_HASH_KEY);
    await SecureStore.setItemAsync(LOCK_ENABLED_KEY, '0');
  }
  return ok;
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = await getStoredPinHash();
  if (!stored) return false;
  return (await hash(pin)) === stored;
}
