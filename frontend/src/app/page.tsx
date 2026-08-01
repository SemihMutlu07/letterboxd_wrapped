import type { Metadata } from 'next';
import LetterboxdLanding from '@/components/LetterboxdLanding';

export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
  openGraph: {
    url: '/',
  },
};

export default function Home() {
  return <LetterboxdLanding />;
}
