export type ReviewTextMetrics = {
  text?: string | null;
  text_length?: number | null;
};

export function reviewCharLength(review: ReviewTextMetrics): number {
  const textLength = review.text?.length;
  if (textLength != null) return textLength;
  return review.text_length ?? 0;
}
