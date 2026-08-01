# TR/EN internationalization research

**Date:** 2026-08-01  
**Scope:** Full-site Turkish and English support in the Next.js 15 frontend while preserving `output: 'export'`.

## Decision

**SHIP B:** statically generate explicit `/en/*` and `/tr/*` routes, backed by one small typed i18n module and local catalogs.  
**DEFER C:** do not add `next-intl` until ICU-style messages, extraction tooling, or more locales justify its integration cost.  
**Do not use A as the end state:** a client-only locale context is acceptable for a short-lived prototype, but cannot produce locale-correct initial HTML, metadata, or `<html lang>`.

This is the simplest approach that meets “full-site” rather than only translating hydrated UI. Next.js documents the `app/[lang]` pattern and build-time locale generation; static export supports dynamic routes only when their values are supplied by `generateStaticParams` ([Next.js internationalization](https://nextjs.org/docs/15/app/guides/internationalization), [static exports](https://nextjs.org/docs/15/app/guides/static-exports), [`generateStaticParams`](https://nextjs.org/docs/15/app/api-reference/functions/generate-static-params)).

## Current repo inventory

| Surface | Current state | i18n implication |
| --- | --- | --- |
| Build/runtime | `frontend/next.config.ts` uses `output: 'export'`; Next `15.5.21`, React `19.1.0`; no i18n package | Every locale route must be known at build time. Do not depend on request cookies or middleware. |
| Document shell | `frontend/src/app/layout.tsx` hardcodes English metadata and `<html lang="en">` | The locale route's root layout must own localized metadata and `lang`. |
| Shared navigation | `AppHeader.tsx` contains English navigation labels | Mount the locale provider above all pages, not only results. |
| Landing/loading | `LetterboxdLanding.tsx`, `LoadingScreen.tsx`, `PosterGuessGame.tsx`, `UploadZone.tsx`, `ExportInstructions.tsx` contain many literals; loading messages are already mixed TR/EN | Migrate as complete surfaces, including rotating/progress and error copy. |
| Results | `ResultsPage.tsx`, `ResultsContent.tsx`, section components, and detail modals contain distributed labels and dynamic prose | Use message keys and formatters; do not centralize only headings while leaving generated sentences behind. |
| Other flows | `/watchlist`, `/findfilm`, `WatchlistCompare.tsx`, `SwipeDeck.tsx`, and `DateNight.tsx` contain form, validation, result, and recommendation copy | All routes need locale-prefixed static counterparts. |
| Story/share | `StoryExperience.tsx`, `ShareModal.tsx`, `ShareCard.tsx`, and seven variants in `share/registry.tsx` contain narrative and exported-card text | Modal chrome and the captured card tree both require translation. |
| Errors/progress | `lib/errors.ts` and `lib/api.ts` map some codes, but raw backend English progress/errors are also displayed | Stable codes/stages must be the translation seam; raw messages remain diagnostics/fallbacks. |
| Existing provider pattern | `lib/theme.tsx` provides theme only around results and has no persistence | i18n must be a global route-level provider with explicit locale input. |

## Platform constraints from primary sources

1. **Static export is build-time, not request-time.** With `output: 'export'`, routes become HTML files. Dynamic routes without `generateStaticParams`, cookies, redirects, headers, and middleware are unsupported ([Next.js static exports](https://nextjs.org/docs/15/app/guides/static-exports)). Therefore Accept-Language negotiation or a cookie-based server redirect is not a portable solution here.
2. **Locale prefixes are compatible with static export.** A `[locale]` segment can return `{locale: 'en'}` and `{locale: 'tr'}` from `generateStaticParams`; Next runs it during `next build` before the relevant layouts and pages ([Next.js `generateStaticParams`](https://nextjs.org/docs/15/app/api-reference/functions/generate-static-params)).
3. **Metadata must be decided before hydration.** `metadata` and `generateMetadata` are Server Component exports; route params can drive pre-rendered metadata in the initial HTML ([Next.js `generateMetadata`](https://nextjs.org/docs/15/app/api-reference/functions/generate-metadata)). A locale read from `localStorage` cannot localize that build output.
4. **The first client render must match the generated HTML.** React treats server/client mismatches as bugs and does not guarantee mismatched attributes will be patched ([React `hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot)). Reading `navigator.language` or `localStorage` during the initial render is therefore unsafe unless the static HTML used the same locale. Effects run only on the client and are suitable for preference persistence after hydration ([React `useEffect`](https://react.dev/reference/react/useEffect)).
5. **Page language is an accessibility contract.** WCAG's sufficient technique is a valid BCP 47 `lang` value on `<html>` matching the primary page language; this supports correct assistive-technology pronunciation ([WCAG H57](https://www.w3.org/WAI/WCAG22/Techniques/html/H57), [WCAG language of page](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html), [MDN `lang`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang)).
6. **Formatting belongs to locale-aware APIs.** Use an explicit locale with `Intl.NumberFormat`, `Intl.DateTimeFormat`, and `Intl.PluralRules`; plural categories select catalog messages rather than English suffix concatenation ([ECMA-402](https://tc39.es/ecma402/), [MDN number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat), [date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat), [plural](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules)). Set an explicit time zone anywhere a date is rendered during both build and hydration.

## Options

| Option | Static-export fit | Initial HTML, metadata, `lang` | Cost and risks | Verdict |
| --- | --- | --- | --- | --- |
| **A. Client-only locale context/catalogs** | Works mechanically because all switching happens after load | Wrong or fixed until hydration; client preference can cause a language flash and cannot localize build-time metadata | Smallest first diff, but creates an architectural ceiling and hydration discipline burden | **Prototype only** |
| **B. `/en` and `/tr` static generation** | Native fit through `[locale]` + `generateStaticParams` | Locale-correct at build time; shareable/bookmarkable URLs; localized metadata and `lang` | Requires moving each page under the locale segment and preserving locale in links | **Recommended** |
| **C. `next-intl`** | Possible with `[locale]`, `generateStaticParams`, and `setRequestLocale` | Can achieve the same correctness as B | Adds plugin/request config/provider conventions; standard routing setup often assumes middleware, which static export cannot use; this client-heavy repo gets less server-component bundle benefit | **Defer** |

`next-intl` itself documents the locale segment, `generateStaticParams`, and `setRequestLocale` requirements for static rendering ([routing setup](https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing)). It describes `setRequestLocale` as a current workaround. Its easiest client setup sends messages through `NextIntlClientProvider`; sending all messages to the client can increase markup/bundle work ([server/client components](https://next-intl.dev/docs/environments/server-client-components)). Those capabilities are useful later, but are not necessary for two local catalogs now.

## Proposed shape

```text
frontend/src/
  app/
    [locale]/
      layout.tsx          # validates locale; owns <html lang> and metadata
      page.tsx
      results/page.tsx
      watchlist/page.tsx
      findfilm/page.tsx
  i18n/
    locales.ts            # Locale = 'en' | 'tr'; validation and defaults
    catalog.en.ts
    catalog.tr.ts
    index.ts              # catalog loading and typed lookup
    I18nProvider.tsx
    routing.ts            # add/swap locale prefix; retain search/hash
```

Keep this a deep module with a small public interface:

```ts
type I18n = {
  locale: 'en' | 'tr';
  t: (key: MessageKey, values?: MessageValues) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | number, options?: Intl.DateTimeFormatOptions) => string;
  plural: (value: number, forms: PluralForms) => string;
};
```

- Pass the validated route locale into the provider; do not let consumers independently infer it.
- Keep keys namespaced by product surface (`landing.*`, `results.*`, `share.*`, `errors.*`) and require both catalogs to satisfy the same typed shape.
- The switcher changes the URL prefix and then stores `mw_locale` for future visits. Persistence is a convenience, not the source of truth for a rendered locale route.
- Preserve pathname, query, and hash when changing locale. Internal links must always carry the active prefix.
- For `/`, choose one explicit static behavior: a small language chooser or the default-language landing. A post-hydration navigation to the stored/browser locale is possible but is not an HTTP redirect and may flash. A true redirect requires static-host configuration outside this Next.js app.

## Migration phases

1. **Foundation and shell**
   - Add typed locales/catalogs, route validation, locale provider, route helper, and switcher.
   - Generate `en` and `tr` with `generateStaticParams`.
   - Localize `<html lang>`, title, description, Open Graph fields, header, and not-found/error shell.
   - Establish a catalog parity check before broad string migration.
2. **Core completion path**
   - Move landing/upload/loading/game and results pages as whole surfaces.
   - Replace number/date/plural interpolation with the module formatters.
   - Translate all results sections, modal labels, empty states, validation, retry, and offline states.
3. **Secondary product flows**
   - Migrate watchlist compare, swipe deck, date night, and find-film routes.
   - Convert backend progress/error handling to stable `error_code`, `stage`, and `reason` mappings. Display raw backend text only as an unknown-code fallback or diagnostic detail.
4. **Story and exported media**
   - Migrate every story slide and dynamic sentence.
   - Pass locale/catalog data into all seven share-card variants and both orientations before `html-to-image` capture.
   - Visually verify Turkish glyphs, wrapping, truncation, and vertical/horizontal exports.
5. **Close the compatibility gap**
   - Decide the permanent `/` behavior and legacy unprefixed route policy.
   - Add locale-aware canonical/alternate metadata if SEO requires it.
   - Remove temporary fallbacks only after a literal-string audit and full EN/TR flow QA.

## Known limits and acceptance gates

- **Metadata and `<html lang>`:** A client-only implementation cannot meet this gate. Each prefixed route must ship the correct language in downloaded HTML, not only after an effect.
- **Backend errors/progress:** Translating current English sentences by string equality is brittle. Full coverage needs stable machine codes for errors, queue state, processing stages, pause reasons, and backend-derived labels such as rating personalities/personas.
- **Share-card PNG text:** PNG text is fixed at capture time. Translating only `ShareModal` leaves the exported image English; every registered card render tree must receive the active locale before capture.
- **Dates:** Browser-default time zones can produce different calendar text between build and hydration. Specify the intended time zone for content rendered in both environments.
- **Root negotiation:** Static export cannot perform request-header negotiation. Browser preference can inform a chooser or client navigation; it cannot replace explicit locale URLs.
- **Fonts/layout:** The current Latin font subset should include Turkish characters, but `İ/ı/Ş/ş/Ğ/ğ/Ç/ç/Ö/ö/Ü/ü` and translated line lengths still require visual QA.
- **Definition of full-site:** Both languages must cover navigation, loading, validation, errors, empty/offline states, dynamic results prose, stories, and exported images—not only primary headings.

## Primary references

- [Next.js 15: Internationalization](https://nextjs.org/docs/15/app/guides/internationalization)
- [Next.js 15: Static exports](https://nextjs.org/docs/15/app/guides/static-exports)
- [Next.js 15: `generateStaticParams`](https://nextjs.org/docs/15/app/api-reference/functions/generate-static-params)
- [Next.js 15: `generateMetadata`](https://nextjs.org/docs/15/app/api-reference/functions/generate-metadata)
- [React: `hydrateRoot`](https://react.dev/reference/react-dom/client/hydrateRoot), [`createContext`](https://react.dev/reference/react/createContext), [`useEffect`](https://react.dev/reference/react/useEffect)
- [ECMA-402 internationalization API](https://tc39.es/ecma402/) and MDN [`Intl.NumberFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat), [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat), [`Intl.PluralRules`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules)
- [WCAG 2.2: Language of Page](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html) and [Technique H57](https://www.w3.org/WAI/WCAG22/Techniques/html/H57)
- [`next-intl`: App Router with locale routing](https://next-intl.dev/docs/getting-started/app-router/with-i18n-routing) and [server/client components](https://next-intl.dev/docs/environments/server-client-components)
