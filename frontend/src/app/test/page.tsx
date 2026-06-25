'use client';

import { useEffect } from 'react';

export default function TestPage() {
  useEffect(() => {
    const sampleData = {
      "task_id": null,
      "username": "watchthemengo",
      "source": "scrape",
      "timestamp": "2026-06-24T13-46-02Z",
      "ok": true,
      "sinefil_meter": {
        "score": 67,
        "type": "Eclectic Viewer",
        "description": "A healthy mix of mainstream hits and off-the-beaten-path picks."
      },
      "stats": {
        "total_films": 144,
        "average_rating": 3.8,
        "days_watched": 127,
        "top_languages": [
          { "language": "en", "count": 98 },
          { "language": "ja", "count": 12 },
          { "language": "fr", "count": 8 }
        ],
        "top_directors": [
          { "name": "Christopher Nolan", "count": 5, "avg_rating": 4.4 },
          { "name": "Denis Villeneuve", "count": 4, "avg_rating": 4.3 },
          { "name": "Paul Thomas Anderson", "count": 3, "avg_rating": 4.1 }
        ],
        "top_genres": [
          { "name": "Action", "count": 42 },
          { "name": "Drama", "count": 38 },
          { "name": "Sci-Fi", "count": 35 }
        ],
        "top_actors": [
          { "name": "Tom Cruise", "count": 6, "avg_rating": 4.0 },
          { "name": "Cillian Murphy", "count": 5, "avg_rating": 4.2 }
        ],
        "decades": [
          { "decade": "2020", "count": 48 },
          { "decade": "2010", "count": 52 },
          { "decade": "2000", "count": 28 }
        ],
        "average_runtime": 128,
        "review_analysis": {
          "total_reviews": 42,
          "reviews": []
        }
      },
      "all_films": [
        {
          "_index": 0,
          "title": "Oppenheimer",
          "director": "Christopher Nolan",
          "year": 2023,
          "rating": 5.0,
          "runtime": 180,
          "language": "en",
          "poster_path": "/8Gxv8gSFCU0XGDykEGClnuSzesJ.jpg",
          "genres": ["Drama", "History"],
          "release_year": 2023
        },
        {
          "_index": 1,
          "title": "Dune: Part Two",
          "director": "Denis Villeneuve",
          "year": 2024,
          "rating": 4.5,
          "runtime": 166,
          "language": "en",
          "poster_path": "/1pdfLvkbY9ohJlCjQELA6U9y2b2.jpg",
          "genres": ["Sci-Fi", "Action"],
          "release_year": 2024
        },
        {
          "_index": 2,
          "title": "Lolita",
          "director": "Stanley Kubrick",
          "year": 1962,
          "rating": 1.0,
          "runtime": 152,
          "language": "en",
          "poster_path": "/4w1IraS6BreMVFLIBKznqwdfklI.jpg",
          "genres": ["Drama"],
          "release_year": 1962
        }
      ],
      "rated_films": [
        {
          "_index": 0,
          "title": "Oppenheimer",
          "your_rating": 5.0,
          "average_rating": 8.1,
          "rating": 5.0
        },
        {
          "_index": 2,
          "title": "Lolita",
          "your_rating": 1.0,
          "average_rating": 7.3,
          "rating": 1.0
        }
      ],
      "rating_outliers": {
        "higher": [
          {
            "_index": 2,
            "title": "Lolita",
            "your_rating": 1.0,
            "average_rating": 7.3,
            "director": "Stanley Kubrick",
            "runtime": 152,
            "language": "en",
            "review": null
          }
        ],
        "lower": [
          {
            "_index": 1,
            "title": "Dune: Part Two",
            "your_rating": 4.5,
            "average_rating": 7.9,
            "director": "Denis Villeneuve",
            "runtime": 166,
            "language": "en",
            "review": "Too long but visually stunning"
          }
        ]
      }
    };

    sessionStorage.setItem('letterboxdStats', JSON.stringify(sampleData));
    window.location.href = '/results';
  }, []);

  return (
    <div style={{ padding: '40px', fontFamily: 'monospace', textAlign: 'center' }}>
      <p>Loading test data...</p>
    </div>
  );
}
