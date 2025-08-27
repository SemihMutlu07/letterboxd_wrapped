# Consent-Gated Analytics System

This analytics system respects user privacy by gating data collection behind explicit consent.

## Usage

### Always Allowed (No Consent Required)
```typescript
import { trackEvent } from '@/lib/analytics';

// Generic events - always tracked
trackEvent('page_view', { page: 'results' });
trackEvent('feature_used', { feature: 'download' });
trackEvent('error', { error: 'upload_failed' });
```

### Consent-Gated Analytics
```typescript
import { trackConsentedEvent, trackFilmStats } from '@/lib/analytics';

// Only tracked if user gave consent
trackConsentedEvent('detailed_analysis', {
  total_films: 150,
  average_rating: 3.5
});

// Film statistics tracking (automatically anonymized)
trackFilmStats({
  total_films: 150,
  total_ratings: 120,
  average_rating: 3.5,
  top_genres: ['Action', 'Drama'],
  top_directors: ['Christopher Nolan', 'Quentin Tarantino']
});
```

## Consent Management

```typescript
import { hasConsent, saveConsentDecision } from '@/lib/sessionUtils';

// Check if user has given consent
if (hasConsent()) {
  // User agreed to data collection
  trackConsentedEvent('user_behavior', { action: 'share_results' });
}

// Save user's consent decision
saveConsentDecision('accept'); // or 'decline'
```

## Data Safety

- **Always Allowed**: Page views, feature usage, errors, generic events
- **Consent Required**: Film statistics, user behavior, detailed analytics
- **Never Tracked**: Raw film titles, personal ratings, user reviews, identifying information

## Implementation Notes

1. **Session Storage**: Consent decisions are stored in `sessionStorage` and persist for the browser session
2. **Automatic Anonymization**: The `trackFilmStats` function automatically converts raw data to aggregated counts
3. **Error Handling**: Analytics failures don't block user functionality
4. **Development**: All analytics are logged to console in development mode

## Example Integration

```typescript
// In a component
import { trackEvent, trackConsentedEvent } from '@/lib/analytics';

const handleShare = () => {
  // Always track the share action
  trackEvent('share_attempted', { method: 'social' });
  
  // Only track detailed stats with consent
  if (hasConsent()) {
    trackConsentedEvent('share_completed', {
      platform: 'twitter',
      has_image: true
    });
  }
};
```
