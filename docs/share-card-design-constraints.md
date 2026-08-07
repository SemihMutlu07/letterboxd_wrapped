# ShareCard Design Constraints

Status: active design constraint for the next ShareCard pass.

## Primary canvas: Instagram Story

- Export canvas: `1080 x 1920` (`9:16`).
- Critical-content safe zone: full width between `y=250` and `y=1670`
  (`1080 x 1420`).
- Top danger zone: `y=0-250`; Instagram profile, handle, timestamp, progress,
  and close controls can cover this region.
- Bottom danger zone: `y=1670-1920`; reply, like, share, and link-sticker UI can
  cover this region.
- Keep critical text, logos, identities, metrics, and CTAs at least `60px` from
  the left and right edges. `40px` is the absolute minimum, not the target.
- Background color and full-bleed imagery may extend through danger zones.
- A CTA or link sticker belongs above `y=1670`, preferably in the lower third
  of the safe zone.
- Reels cross-posting is not the current layout target. If added later, reserve
  at least `400px` at the bottom for captions, audio, and reaction controls.

## Media geometry

- Story is a vertical composition, not a desktop card scaled into a tall box.
- Actor and director sources are portrait images. Preserve their focal subject
  with an explicit portrait aspect ratio and deliberate `object-position`.
- Film sources are portrait posters. Poster grids must reserve their final
  geometry and preserve legibility; do not stretch, auto-shrink, or overlap
  them to fill leftover space.
- Layout distribution must be solved independently for every approved Story
  composition. A responsive scale transform alone is not an accepted layout.

## Rejected outcomes from the 2026-08-01 review

- Reject the dense black dashboard composition where headings, portraits,
  metric tiles, and posters collapse into one another.
- Reject the light editorial composition when it leaves uncontrolled empty
  space and treats fixed sizes as responsive behavior.
- Reject the Double Feature composition when the two portraits, oversized
  watched count, headline, metrics, and poster rail produce uneven vertical
  distribution.
- Reject the Contact Sheet composition when header typography and decorative
  marks overlap or escape their allocated regions.
- Do not continue the mustard-and-blue Admit One direction shown in the final
  review reference.

## Acceptance rules

1. All critical content remains inside the Story safe zone.
2. No text, image, border, or decorative mark overlaps another region at the
   exported `1080 x 1920` size.
3. Portraits and posters keep stable vertical aspect ratios and intentional
   crops.
4. The composition has deliberate vertical rhythm across the usable `1420px`;
   neither accidental crowding nor an unexplained empty field is acceptable.
5. Verification uses the real `/smt` fixture and the exact exported PNG, not
   only the scaled modal preview.
