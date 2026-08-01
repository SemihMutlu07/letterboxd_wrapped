import type { ReactNode } from 'react';

import RootDocument from '@/app/RootDocument';

export default function LegacyRootLayout({ children }: { children: ReactNode }) {
  return <RootDocument locale="en">{children}</RootDocument>;
}

