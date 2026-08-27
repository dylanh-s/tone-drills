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
