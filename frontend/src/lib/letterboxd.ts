import { parseLetterboxdUsername } from '@/lib/filename';

export function extractLetterboxdUsername(fileName: string): string | null {
  return parseLetterboxdUsername(fileName);
}
