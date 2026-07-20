import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewAnalysisSection from './ReviewAnalysisSection';
import type { StatsData } from './types';

const baseStats: Partial<StatsData> = {};

function buildReviews(n: number, textFor: (index: number) => string = (i) => `Review text for film ${i + 1}.`) {
  return Array.from({ length: n }, (_, i) => ({
    title: `Film ${i + 1}`,
    year: String(2020 + (i % 5)),
    text: textFor(i),
    likes: n - i,
    rating: 3.5,
  }));
}

function renderSection(
  reviewOverrides = {},
  wordFrequency = [{ word: 'love', count: 5 }],
  reviews = buildReviews(20),
) {
  const stats: StatsData = {
    ...baseStats,
    total_films: 100,
    average_rating: 3.5,
    days_watched: 10,
    average_runtime: 108,
    top_genres: [],
    top_directors: [],
    top_actors: [],
    top_countries: [],
    top_languages: [],
    decades: [],
    rating_distribution: {},
    review_analysis: {
      total_reviews: 20,
      reviews_with_text: 20,
      review_rate: 1,
      total_words_written: 2000,
      avg_review_length_words: 100,
      unique_words_used: 500,
      vocab_richness: 0.5,
      word_frequency: wordFrequency,
      bigram_frequency: [],
      avg_length_by_rating: {},
      language_mix: {},
      reviews,
    },
    ...(reviewOverrides as Partial<StatsData>),
  };
  return render(<ReviewAnalysisSection stats={stats} />);
}

describe('ReviewAnalysisSection', () => {
  it('renders only the first page of written reviews initially', () => {
    renderSection();
    const cards = screen.getAllByText(/Review text for film/);
    expect(cards.length).toBe(3);
  });

  it('expands reviews on "Show more reviews" click', async () => {
    renderSection();
    expect(screen.getAllByText(/Review text for film/).length).toBe(3);
    await userEvent.click(screen.getByRole('button', { name: /Show more reviews/i }));
    expect(screen.getAllByText(/Review text for film/).length).toBe(6);
  });

  it('resets pagination when sort changes', async () => {
    renderSection();
    await userEvent.click(screen.getByRole('button', { name: /Show more reviews/i }));
    expect(screen.getAllByText(/Review text for film/).length).toBe(6);
    await userEvent.click(screen.getByRole('button', { name: /Longest/i }));
    expect(screen.getAllByText(/Review text for film/).length).toBe(3);
  });

  it('filters reviews by selected word', async () => {
    renderSection(
      {},
      [{ word: 'love', count: 5 }],
      buildReviews(20, (i) => (i === 0 ? 'I love this film deeply.' : `Review text for film ${i + 1}.`)),
    );
    const loveButton = screen.getByRole('button', { name: /love/i });
    await userEvent.click(loveButton);
    expect(screen.getByText((_, node) => {
      return node?.tagName.toLowerCase() === 'p' && Boolean(node.textContent?.includes('Filtering: "love"'));
    })).toBeInTheDocument();
  });

  it('keeps the review list paginated when sort changes', async () => {
    renderSection();
    await userEvent.click(screen.getByRole('button', { name: /Longest/i }));
    expect(screen.getAllByText(/Review text for film/).length).toBe(3);
  });

  it('derives the longest review from review characters when backend summary disagrees', async () => {
    const reviews = [
      { title: 'Many Words', year: '2024', text: 'a b c d e f g', char_length: 13, word_count: 7, likes: 0, rating: 3 },
      { title: 'Character Winner', year: '2023', text: 'abcdefghijklmnop', char_length: 16, word_count: 1, likes: 0, rating: 4 },
    ];
    renderSection({
      review_analysis: {
        total_reviews: 2, reviews_with_text: 2, review_rate: 1, total_words_written: 8,
        avg_review_length_words: 4, unique_words_used: 8, vocab_richness: 1,
        word_frequency: [], bigram_frequency: [], avg_length_by_rating: {}, language_mix: {},
        longest_review: { title: 'Wrong Summary', year: '2000', length: 999 },
        reviews,
      },
    }, [], reviews);

    expect(screen.getByText('Character Winner (2023)')).toBeInTheDocument();
    expect(screen.queryByText(/Wrong Summary/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Longest/i }));
    const renderedReviews = screen.getAllByRole('listitem');
    expect(renderedReviews[0]).toHaveTextContent('Character Winner');
  });
});
