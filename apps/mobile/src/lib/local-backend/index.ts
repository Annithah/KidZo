/** Device wiring for the on-device backend: file storage and SHA-256 from expo-crypto. */
import * as Crypto from 'expo-crypto';
import { appStore } from '../storage';
import { createLocalBackend } from './server';

export { LOCAL_BASE_URL } from './server';

export const localBackend = createLocalBackend({
  store: appStore,
  randomId: () => Crypto.randomUUID(),
  digest: (input) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input),
});
