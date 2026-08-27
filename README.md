# tone-drills

Drill mandarin tones for weird characters.

## Web version (static site)

A TypeScript port of the interactive drill that runs entirely in the browser —
no server, no audio generation at runtime. It plays the pre-generated clips in
[`questions/+0/`](questions/+0) and mirrors the terminal UI (classic + lucia
modes, click **and** keyboard input). Speed is fixed at 0%; the 1–4 voice
control is kept.

### Run locally

```bash
npm install      # one-time: dev deps (TypeScript + esbuild)
npm run build    # type-check, then bundle src/ -> js/main.js
python3 -m http.server 8000   # or any static server
# open http://localhost:8000/
```

Use `npm run watch` to recompile on save while developing.

Add `?seed=123` to the URL to reproduce a specific draw.

Pushes to `main` are built and published by
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### Adding or editing words

The word lists live in [`src/data.ts`](src/data.ts):

- **`SONG` / `MING`** — the surname pairs used in classic mode, as
  `["字", "1-2"]` (word + its tone-pair answer). They're concatenated into
  `NAMES`.
- **`LUCIA_WORDS`** — common words grouped by tone pair (`"1-2": ["中国", …]`),
  used as the lucia-mode options.

Add or edit entries there and the drill picks them up automatically — no other
code changes needed.

**Audio, though, is not automatic.** The site never synthesizes speech; it only
plays pre-generated clips at `questions/+0/<voice>/<word>.mp3` (one per voice,
plus a `_frame` version). A new word has no clip, so it will appear in the drill
but stay silent until you generate one. Use the Python tool (needs `edge-tts` +
`ffmpeg`, see `requirements.txt`):

```bash
python tone_drill.py --mode generate   # caches audio for every word/voice
```

It skips clips that already exist. The web app only reads the `+0` (0% speed)
folder.

**To add words to the live website:** make the `src/data.ts` edit, generate the
audio, and open a PR that **includes the new `questions/+0/…` mp3 files**. CI
builds the JavaScript but does **not** synthesize audio — if the clips aren't
committed, the new words will be silent on the deployed site.

### Layout

| Path | What |
|------|------|
| `index.html` | page shell + styles (the k9s palette) |
| `src/*.ts` | source: `data`, `rng`, `logic`, `audio`, `app`, `main` |
| `js/main.js` | esbuild bundle — built by `npm run build`, git-ignored |
| `questions/+0/<voice>/<word>.mp3` | pre-generated clips (bare + `_frame`) |

The web port uses its own seeded RNG, so a given seed is stable within the site
but does not reproduce the Python CLI's exact draws.

## Python version (CLI)

The original terminal drill still lives in `tone_drill.py` / `tui.py` and can
generate audio, build exam mp3s, and run at multiple speeds. See the module
docstring in `tone_drill.py`.
