export type ReviewTextMetrics = {
  text?: string | null;
  text_length?: number | null;
  word_count?: number | null;
};

export function reviewCharLength(review: ReviewTextMetrics): number {
  const textLength = review.text?.length;
  if (textLength != null) return textLength;
  return review.text_length ?? 0;
}

export function reviewWordCount(review: ReviewTextMetrics): number {
  if (review.word_count != null) return review.word_count;
  const trimmed = review.text?.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}
