export type ReviewTextMetrics = {
  title?: string | null;
  year?: string | number | null;
  likes?: number | null;
  text?: string | null;
  text_length?: number | null;
  char_length?: number | null;
  word_count?: number | null;
};

const URL_RE = /(?:https?:\/\/|www\.)\S+/giu;
const HTML_TAG_RE = /<[^>]+>/g;
const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

function readableText(text: string): string {
  return text.replace(URL_RE, ' ').replace(HTML_TAG_RE, ' ').trim();
}

function compareText(a: unknown, b: unknown): number {
  const left = String(a ?? '').normalize('NFC');
  const right = String(b ?? '').normalize('NFC');
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareReviewIdentity(a: ReviewTextMetrics, b: ReviewTextMetrics): number {
  return compareText(a.title, b.title)
    || compareText(a.year, b.year)
    || compareText(a.text, b.text);
}

export function reviewCharLength(review: ReviewTextMetrics): number {
  if (review.text != null) return readableText(review.text).length;
  return review.char_length ?? review.text_length ?? 0;
}

export function reviewWordCount(review: ReviewTextMetrics): number {
  if (review.text != null) return readableText(review.text).match(WORD_RE)?.length ?? 0;
  return review.word_count ?? 0;
}

export function hasReadableReviewText(review: ReviewTextMetrics): boolean {
  return review.text != null && readableText(review.text).length > 0;
}

export function compareReviewsByWordCount(
  a: ReviewTextMetrics,
  b: ReviewTextMetrics,
): number {
  return reviewWordCount(b) - reviewWordCount(a)
    || reviewCharLength(b) - reviewCharLength(a)
    || compareReviewIdentity(a, b);
}

export function compareReviewsByLikes(
  a: ReviewTextMetrics,
  b: ReviewTextMetrics,
): number {
  return (b.likes ?? 0) - (a.likes ?? 0)
    || compareReviewsByWordCount(a, b);
}

export function selectLongestReview<T extends ReviewTextMetrics>(
  reviews: readonly T[],
): T | undefined {
  return reviews
    .filter(hasReadableReviewText)
    .slice()
    .sort(compareReviewsByWordCount)[0];
}
