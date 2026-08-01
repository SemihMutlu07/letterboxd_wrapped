# Local analysis fixtures

`semihmutsuz.json` is the development payload loaded by `/smt`.

`semihmutsuz-media/` contains the public TMDB poster and person images required
by the ShareModal sample:

- the first five rated-film posters used by the share-card film strip;
- the available first five actor portraits;
- the first five non-duplicate director portraits.

`scripts/prepare-smt-fixture.mjs` copies both the payload and media into the
ignored `public/.dev/` directory. Matching `poster_path` and `profile_path`
values are rewritten to local URLs, so the visual fixture does not depend on a
running backend or desktop worker.

When the fixture ranking changes, update the JSON and the corresponding media
files together. A data-only fixture is not considered visually complete.
