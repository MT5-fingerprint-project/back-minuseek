import { FileDigest } from './file-digest.vo';

// fixture for tests that need a valid FileDigest but don't care about the actual value
export const ANY_SEAL = FileDigest.from('0'.repeat(63) + '1');
