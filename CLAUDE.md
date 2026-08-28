# CLAUDE.md

Context for Claude Code sessions. Read this before diving into the code.

## What this repo is

A Mandarin tone-perception drill. You hear a two-syllable word and identify its
tone pair. There are **two independent programs** in this repo:

1. **Web app** (`index.html`, `src/*.ts`) — a static, browser-only TypeScript
   port. This is where most new work happens. Deployed to GitHub Pages.
2. **Python CLI** (`tone_drill.py`, `tui.py`) — the original terminal app
   (Textual TUI). Still works; can generate audio and build exam mp3s. Left
   intact but not the focus.

The two share **no code**. See "Word lists are duplicated" below.

## Web app

### How it works
- **Fully static.** No server, no backend, no runtime text-to-speech. It only
  plays pre-generated audio clips that are committed to the repo.
- **Audio:** mp3 clips live in `questions/+0/<voice>/<word>.mp3` (bare) and
  `<word>_frame.mp3` (word inside a 请说…这个词 sentence). `+0` = 0% speed; the
  web app **only ever uses 0% speed** (the Python app supported other speeds;
  those folders still exist but the web app ignores them). 4 zh-CN voices.
  Clips are fetched lazily on demand via `<audio>`, one at a time.
- **RNG:** uses the `seedrandom` npm package (see `src/rng.ts`). Draws are
  stable for a given `?seed=N` within the site but are **not** byte-identical to
  the Python CLI's draws (different PRNG). `?seed=` in the URL is optional.
- **Two answering modes:** `classic` (type the two tone digits, e.g. `14`) and
  `lucia` (pick from 4 played word options with the same tone pair). Toggle
  with `l`. Input is **click + keyboard** — every keyboard shortcut has a
  clickable equivalent.

### File map (`src/`)
| File | Role |
|------|------|
| `data.ts` | Corpus + config: `NAMES` (classic surname pairs), `LUCIA_WORDS` (words grouped by tone pair), `VOICES`, constants. Pure data. |
| `rng.ts` | `Rng` class wrapping `seedrandom` + `shuffle`/`sample`/`choice` helpers. |
| `logic.ts` | Pure drill logic: `judge`, `toneDigits`, `pickVoice`, `pickItems`, `buildQuestions`, `buildLuciaOptions`, `questionClip` (audio path). Ported from `tone_drill.py`. |
| `audio.ts` | Clip playback via a reused `HTMLAudioElement`. |
| `app.ts` | `DrillApp` — the whole UI. DOM port of the Textual TUI. Renders header/body/footer, handles keys + clicks, scoring, results screen, help overlay. |
| `main.ts` | Bootstrap: reads `?seed=`, starts `DrillApp`. |
| `index.html` | Page shell + **all CSS** (inline, k9s-style dark palette). |

### Build / dev / test
```bash
npm install                    # deps: typescript, esbuild, seedrandom
npm run build                  # tsc typecheck (noEmit) THEN esbuild bundle -> js/main.js
npm run watch                  # esbuild watch (no typecheck)
python3 -m http.server 8000    # serve; open http://localhost:8000/
```
- **ES modules require `http://`** — opening `index.html` via `file://` won't work.
- `js/main.js` is the **single bundled output** and is **git-ignored** — CI
  builds it. Do NOT commit `js/`. `tsconfig.json` has `noEmit: true`; esbuild
  does the actual bundling (it resolves the `.js` import extensions to `.ts`).
- CSS-only changes to `index.html` don't need a rebuild (just reload). Any
  `src/*.ts` change needs `npm run build`.
- **Testing:** serve locally and drive the in-app browser (mcp__Claude_Browser__*).
  Verify audio by checking the network panel for `.mp3` 200/206 responses.

### Deploy
- `.github/workflows/deploy.yml`: on **push to `main`**, runs `npm ci` +
  `npm run build`, assembles a `_site/` with `index.html`, `js/main.js`, and
  `questions/+0/`, and deploys to GitHub Pages. On **PRs** it runs the build as
  a check only (no deploy).
- Live at https://dylanh-s.github.io/tone-drills/
- Pushing anything under `.github/workflows/` needs the git token to have the
  `workflow` scope (`gh auth refresh -s workflow`).

## Word lists are duplicated (important)

The web app reads `src/data.ts`; the Python audio generator reads
`tone_drill.py`'s own `NAMES`/`LUCIA_WORDS`. They are **separate copies**. To
add a word:
1. Add it to `src/data.ts` (so the drill shows it).
2. Add it to `tone_drill.py` (so the generator can synthesize it).
3. Run `python tone_drill.py --mode generate` (needs `edge-tts` + `ffmpeg`) to
   create the clips.
4. Commit the new `questions/+0/…` mp3s — **CI does not generate audio**, so a
   word without committed clips is silent on the live site.

See the README's "Adding or editing words" section for the fuller version.

## Layout constraints to preserve (these were hard-won)

The question panel must **not jump** when going from the answering view to the
result view. Current approach (in `app.ts` `renderQuestion` + `index.html`):
- The panel **hugs its content** (no fixed min-height) and `#body` is
  **top-anchored** (`align-items: flex-start`, not centred). So the panel grows
  downward for the verdict while the hanzi and options stay pinned.
- `.opt-label` (answering) and `.opt-result` (answered) share `line-height` so
  option rows are the exact same height in both states (no pixel drift).
- The prompt hanzi is centred via a `.hanzi-spacer` (flex:1) that balances the
  right-hand `.hanzi-play` buttons, which align to the option play-button column.

If you change the question layout, re-check answer→result in **both** modes for
jumping/whitespace.

## Conventions
- **Input parity.** The drill is keyboard-first: essentially every "game"
  control (play, answer, navigate, toggle modes, settings) should be reachable
  from the keyboard. But keyboard is not enough — every control must ALSO have a
  clickable equivalent and work for **mouse and mobile/touch** users. When you
  add or change a control, wire up both the key handler (`onKey` in `app.ts`)
  and a clickable button, and keep the footer/help hints in sync.
- The user prefers small, focused commits and often merges via PR (`gh pr`), but
  sometimes says "straight to main" — follow whichever they ask.
- Match the existing terminal/k9s aesthetic: dark `#101418`, accent `#50b4ff`,
  green/red/orange verdicts, monospace, bordered "panel" cards.
