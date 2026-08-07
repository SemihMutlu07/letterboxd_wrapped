# Local analysis fixtures

`semihmutsuz.json` is the development payload loaded by `/smt`.

`semihmutsuz-share-card-media.json` is the deterministic local ShareModal media
contract. It records exactly:

- two selected portraits: Woody Allen and Martin Scorsese;
- the first ten `rated_films` posters. The live card currently renders the first
  five; the next five are saved for rapid layout iteration.

`scripts/prepare-smt-fixture.mjs` validates that contract and copies only those
12 files into the ignored `public/.dev/` directory. Matching `poster_path` and
`profile_path` values are rewritten to local URLs. The script performs no
downloads, so the visual fixture does not depend on the network, backend, or
desktop worker.

When the fixture ranking changes, update the JSON and the corresponding media
files together. A data-only fixture is not considered visually complete.
