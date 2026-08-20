import { REQUIRED_MINUTIAE } from '../../../shared/domain/forensics/minutiae';
import { InsufficientMinutiaeError } from './errors/insufficient-minutiae.error';

export { REQUIRED_MINUTIAE };

export function assertEnoughMinutiae(
  traceMinutiae: number,
  referenceMinutiae: number,
): void {
  if (traceMinutiae < REQUIRED_MINUTIAE) {
    throw new InsufficientMinutiaeError(
      'trace',
      traceMinutiae,
      REQUIRED_MINUTIAE,
    );
  }
  if (referenceMinutiae < REQUIRED_MINUTIAE) {
    throw new InsufficientMinutiaeError(
      'reference-print',
      referenceMinutiae,
      REQUIRED_MINUTIAE,
    );
  }
}
