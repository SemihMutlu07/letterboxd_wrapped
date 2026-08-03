import { catalogs, type MessageKey } from './catalogs';
import type { Locale } from './locales';

/**
 * FAQ entries as catalog key pairs. The copy itself lives in the i18n
 * catalog (catalogs.ts) — this module only maps which keys form the FAQ.
 * Both the landing UI (client) and the JSON-LD FAQPage schema (server)
 * read from here so the visible answers and the structured data never
 * drift apart.
 */
export const FAQ_ITEMS = [
  { q: 'landing.faq.whatIs.question', a: 'landing.faq.whatIs.answer' },
  { q: 'landing.faq.username.question', a: 'landing.faq.username.answer' },
  { q: 'landing.faq.data.question', a: 'landing.faq.data.answer' },
  { q: 'landing.faq.duration.question', a: 'landing.faq.duration.answer' },
  { q: 'landing.faq.free.question', a: 'landing.faq.free.answer' },
  { q: 'landing.faq.csv.question', a: 'landing.faq.csv.answer' },
] as const satisfies readonly { q: MessageKey; a: MessageKey }[];

export type FaqItem = { question: string; answer: string };

export function getFaqItems(locale: Locale): FaqItem[] {
  return FAQ_ITEMS.map(({ q, a }) => ({
    question: catalogs[locale][q],
    answer: catalogs[locale][a],
  }));
}
