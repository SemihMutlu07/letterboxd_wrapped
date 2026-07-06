export type ReviewTextMetrics = {
  text?: string | null;
  text_length?: number | null;
  word_count?: number | null;
  date?: string | null;
  review_date?: string | null;
};

export function reviewCharLength(review: ReviewTextMetrics): number {
  const textLength = review.text?.length;
  if (textLength != null) return textLength;
  return review.text_length ?? 0;
}

export function reviewWordCount(review: ReviewTextMetrics): number {
  if (review.word_count != null) return review.word_count;
  const text = review.text?.trim() ?? '';
  return text ? text.split(/\s+/).length : 0;
}

export function reviewDateLabel(review: ReviewTextMetrics): string | null {
  const raw = review.date ?? review.review_date;
  if (!raw) return null;
  return raw.slice(0, 10);
}
