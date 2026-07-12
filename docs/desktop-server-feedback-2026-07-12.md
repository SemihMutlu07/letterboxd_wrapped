# Desktop Server Feedback — 2026-07-12

Raw request, saved verbatim-in-spirit before implementation starts, so it can be
re-run with a stronger model (e.g. Opus 4.8, high effort) if the first pass is bad.

## Loading screen (desktop view)
1. Loading should sit flush in the center of the screen on desktop. Drop the
   current center-piece visual entirely — show just the film count ticking up
   over time, with a nice small increment animation. One line, no more.
2. Stack "Almost there... wrapping up" / elapsed-time line and the
   "Having a little trouble..." line as two lines, top-aligned, one above the
   other, in the same spot they're in now. Leave the poster-guessing block
   where it is, at the bottom of that div, unchanged in position.
3. Remove "Reading your public Letterboxd diary and film list..." line entirely.
4. Replace the rotating loading messages that currently sound AI-generated.
   New set should include:
   - "nuri bilge ceylan, hakan taşıyan, müslüm gürses"
   - "summer haklıydı"
   - "gaspar noe izleyen çocuktan uzak durucan"
   - "🖐️ absolute cinema 🖐️"
   - replace "sen ne tür film izlersin?" → "jaz belgesel avangarde falan"
   Keep this message block grouped together in its current location, with a
   blank line of spacing above and below. The poster-guess block can be
   shrunk a bit so both fit on mobile screens without overflow.

## Mobile results page
5. Welcoming/hero section needs more left/right padding on mobile (see
   Image #2 — text runs too close to the edges).
6. Image #3 area: increase font size (of the metric explanation tooltip,
   e.g. "Your film hours divided by ~16 waking hours...") — bump it up as
   much as it can be while still fitting.

## Directors / Cast grid
7. The glow/highlight animation that shows an item is clickable fades out
   once and never comes back. Make it pulse again every few seconds,
   repeating until the user clicks one of the items (then stop for that
   session/view).

## Visual contrast fixes (recurring problem — never ship pale/washed-out text)
8. Image #4 area: colors/typography are too faint, easy to miss. Punch up
   contrast and liveliness.
9. Rating Outliers section: the descriptive line right under the heading
   ("Where your rating diverges most from the crowd...") is too pale. Same
   rule applies site-wide — no washed-out secondary text anywhere.

## Reviews section
10. "Longest" sort is still broken — it does not surface the user's actual
    longest written review. Needs a real fix, not a partial one.
11. Film posters are not showing up in the reviews list — fix poster
    resolution there too.
12. Missing feature (was deferred earlier): show the top-liked reviewer
    inside/near the review card, framed as "Your most loyal fan!"

## Quick Facts section
13. Still looks weak/flat (Image #7). Attempt a real rework with more
    interesting/varied metrics. If a full rework doesn't pan out, at minimum
    fix the typography and color liveliness (same rule as #8/#9).

## Notes
- If this attempt underdelivers, retry from this doc with a stronger model
  (Opus 4.8, high reasoning effort) instead of re-deriving the list from chat.
