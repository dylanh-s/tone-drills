// DrillApp — DOM port of the Textual TUI (tui.py). Click + keyboard driven.

import { MAX_VOICES, VOICES_DEFAULT, COUNT } from "./data.js";
import { play, stopPlayback } from "./audio.js";
import {
  buildLuciaOptions,
  buildQuestions,
  judge,
  pickVoice,
  Question,
  questionClip,
  toneDigits,
} from "./logic.js";

const OPT_KEYS = ["a", "s", "d", "f"];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export class DrillApp {
  private questions: Question[];
  private seed: number;
  private idx = 0;
  private lucia = false;
  private showChars = true;
  private showOptChars = false;
  private showHelp = false;
  private results = false;
  private buffer = "";
  private selected: number | null = null;
  private flash = "";
  private numVoices = VOICES_DEFAULT;

  private root: HTMLElement;

  constructor(seed: number, count = COUNT) {
    this.seed = seed;
    this.questions = buildQuestions(count, seed);
    buildLuciaOptions(this.questions, seed);
    this.root = document.getElementById("app")!;
  }

  start(): void {
    window.addEventListener("keydown", (e) => this.onKey(e));
    this.autoplayPrompt();
    this.renderAll();
  }

  // -- derived state ----------------------------------------------------
  private get q(): Question {
    return this.questions[this.idx];
  }
  private get currentVoice(): string {
    return pickVoice(this.q.word, this.numVoices, this.seed);
  }
  private get answered(): number {
    return this.questions.filter((x) => x.userAnswer !== null).length;
  }
  private get score(): number {
    return this.questions.filter((x) => x.correct).length;
  }

  // -- rendering --------------------------------------------------------
  private renderAll(): void {
    this.root.replaceChildren(
      this.renderHeader(),
      this.renderBody(),
      this.renderFooter()
    );
  }

  private grid(rows: [string, HTMLElement | string][]): HTMLElement {
    const g = el("div", "grid");
    for (const [label, value] of rows) {
      const l = el("div", "glabel", label);
      const v = typeof value === "string" ? el("div", "gval", value) : value;
      if (typeof value !== "string") v.classList.add("gval");
      g.append(l, v);
    }
    return g;
  }

  private renderHeader(): HTMLElement {
    const header = el("div");
    header.id = "header";

    const total = this.questions.length;
    const item = this.results ? `${total + 1} / ${total}` : `${this.idx + 1} / ${total}`;

    const info = this.grid([
      ["Mode:", strong(this.lucia ? "lucia" : "classic")],
      ["Voice:", this.currentVoice],
      ["Speed:", "0%"],
      ["Voices:", `${this.numVoices} / ${MAX_VOICES}`],
      ["Seed:", String(this.seed)],
    ]);
    const stats = this.grid([
      ["Item:", strong(item)],
      ["Answered:", `${this.answered} / ${total}`],
      ["Score:", scoreVal(`${this.score} / ${this.answered || 0}`)],
    ]);

    header.append(info, stats);
    return header;
  }

  private renderBody(): HTMLElement {
    const body = el("div");
    body.id = "body";
    if (this.showHelp) {
      body.append(this.renderHelp());
    } else if (this.results) {
      body.append(this.renderResults());
    } else {
      body.append(this.renderQuestion());
    }
    return body;
  }

  private panel(title: string, borderCls: string): HTMLElement {
    const p = el("div", `panel ${borderCls}`);
    p.append(el("div", "panel-title", title));
    return p;
  }

  private renderQuestion(): HTMLElement {
    const q = this.q;
    const answered = q.userAnswer !== null;
    const panel = this.panel("tone-drill", "b-accent");
    // Mode class drives a fixed per-mode min-height so answering and result
    // views are the same height (no re-centre/jump between them).
    const inner = el("div", this.lucia ? "panel-body lucia" : "panel-body");

    inner.append(el("div", "dim small", `Question ${this.idx + 1}`));

    if (this.showChars || answered) {
      inner.append(el("div", "hanzi", q.word));
    } else {
      const masked = [...q.word].map(() => "＿").join(" ");
      inner.append(el("div", "hanzi dim", masked));
    }

    if (this.lucia) {
      inner.append(...this.luciaView(q, answered));
    } else {
      inner.append(...this.classicView(q, answered));
    }

    // Always present (reserves height) so warnings never shift the layout.
    inner.append(el("div", "warn flash", this.flash));

    panel.append(inner);
    return panel;
  }

  // -- classic answer view ---------------------------------------------
  private classicView(q: Question, answered: boolean): HTMLElement[] {
    if (answered) return this.verdictLines(q);

    const typed = el("div", "typed");
    typed.append(el("span", "dim", "Your tones  "));
    typed.append(el("span", "accent big", this.buffer || "—"));

    const hint = el("div", "dim small", "type or tap two digits (e.g. 14), then Enter");

    const pad = el("div", "pad");
    for (const d of ["1", "2", "3", "4"]) {
      const b = el("button", "btn", d);
      b.onclick = () => this.pushDigit(d);
      pad.append(b);
    }
    const back = el("button", "btn", "⌫");
    back.onclick = () => this.eraseDigit();
    const submit = el("button", "btn btn-go", "Submit");
    submit.onclick = () => this.submit();
    pad.append(back, submit);

    return [typed, hint, pad];
  }

  // -- lucia answer view -----------------------------------------------
  private luciaView(q: Question, answered: boolean): HTMLElement[] {
    if (q.options.length === 0) {
      return [el("div", "bad", "no options for this pair")];
    }
    const list = el("div", "options");

    q.options.forEach((opt, i) => {
      const key = OPT_KEYS[i];
      const row = el("div", "opt");
      const chip = el("span", "key", ` ${key} `);
      row.append(chip);

      if (!answered) {
        const shown = this.showOptChars ? opt.word : "＿ ＿";
        const label = el("button", "opt-label", shown);
        if (i === this.selected) label.classList.add("sel");
        label.onclick = () => this.selectOption(i);
        const sent = el("button", "opt-sentence", "▶ 句");
        sent.title = "play inside a sentence";
        sent.onclick = () => this.playOption(i, true);
        row.append(label, sent);
      } else {
        const verdict = judge(q.answer, opt.pair);
        const picked = i === q.selIdx;
        let mark = " ";
        let cls = "dim";
        if (verdict === "correct") { mark = "✓"; cls = "ok"; }
        else if (verdict === "sandhi") { mark = "≈"; cls = "warn"; }
        else if (picked) { mark = "✗"; cls = "bad"; }
        const content = el("div", "opt-result");
        content.append(
          el("span", `mark ${cls}`, mark),
          el("span", cls, opt.word),
          el("span", `${cls} dim-pair`, opt.pair)
        );
        const replay = el("button", "opt-sentence", "▶");
        replay.onclick = () => this.playOption(i, false);
        row.append(content, replay);
      }
      list.append(row);
    });

    const out: HTMLElement[] = [list];
    if (!answered) {
      const choose = el("button", "btn btn-go wide", "Choose");
      choose.onclick = () => this.submitLucia();
      out.push(choose);
    } else {
      out.push(...this.verdictLines(q));
    }
    return out;
  }

  // -- shared verdict / reveal -----------------------------------------
  private verdictLines(q: Question): HTMLElement[] {
    const lines: HTMLElement[] = [];
    const result = q.result ?? (q.correct ? "correct" : "wrong");

    if (result === "correct") lines.push(el("div", "ok bold", "✓ correct"));
    else if (result === "sandhi") lines.push(el("div", "warn bold", "≈ sounds right, but not counted"));
    else lines.push(el("div", "bad bold", "✗ wrong"));

    const ya = el("div", "reveal");
    ya.append(
      el("span", "dim", "you: "),
      el("span", "", q.userAnswer ?? ""),
      el("span", "dim", "     answer: "),
      el("span", "ok bold", q.answer)
    );
    lines.push(ya);

    if (this.lucia && q.options.length) {
      const correct = q.options.filter((o) => judge(q.answer, o.pair) === "correct").map((o) => o.word);
      if (correct.length > 1) {
        lines.push(el("div", "dim", `both ${correct.join(" and ")} were correct`));
      }
    }

    if (toneDigits(q.answer) === "33") {
      lines.push(el("div", "warn small", "⚠ sandhi: 3-3 is pronounced 2-3. The underlying tones are 3-3,"));
      lines.push(el("div", "warn small", "so 2-3 sounds right by ear but is not counted as correct."));
    }

    const nav = el("div", "nav-hint dim small", this.idx === this.questions.length - 1
      ? "Enter / → for results"
      : "Enter / → for the next question");
    lines.push(nav);
    return lines;
  }

  // -- results screen ---------------------------------------------------
  private renderResults(): HTMLElement {
    const total = this.questions.length;
    const correct = this.score;
    const sandhi = this.questions.filter((x) => x.result === "sandhi").length;
    const wrong = total - correct - sandhi;
    const pct = total ? (correct / total) * 100 : 0;

    const panel = this.panel("results", pct >= 80 ? "b-ok" : "b-accent");
    const inner = el("div", "panel-body");
    inner.append(
      el("div", "accent bold big2", "drill complete"),
      el("div", "ok bold huge", `${correct} / ${total}`),
      el("div", "dim", `${pct.toFixed(0)}%`)
    );

    const tally = el("div", "tally");
    tally.append(tallyRow(String(correct), "ok", "correct"));
    if (sandhi) tally.append(tallyRow(String(sandhi), "warn", "sounded right (sandhi, not counted)"));
    tally.append(tallyRow(String(wrong), "bad", "wrong"));
    inner.append(tally);

    const missed = this.questions.filter((x) => !x.correct);
    if (missed.length) {
      inner.append(el("div", "dim bold missed-title", "missed"));
      const mg = el("div", "missed");
      for (const x of missed) {
        const r = el("div", "miss-row");
        r.append(
          el("span", "", x.word),
          el("span", "bad right", x.userAnswer || "—"),
          el("span", "dim", "→"),
          el("span", "ok bold", x.answer)
        );
        mg.append(r);
      }
      inner.append(mg);
    }

    const actions = el("div", "pad");
    const restart = el("button", "btn btn-go", "↻ restart");
    restart.onclick = () => this.restart();
    const review = el("button", "btn", "← review");
    review.onclick = () => this.reviewLast();
    actions.append(restart, review);
    inner.append(actions);

    panel.append(inner);
    return panel;
  }

  private restart(): void {
    this.seed = Math.floor(Math.random() * 1_000_000);
    this.questions = buildQuestions(this.questions.length, this.seed);
    buildLuciaOptions(this.questions, this.seed);
    this.results = false;
    this.idx = 0;
    this.buffer = "";
    this.selected = null;
    this.autoplayPrompt();
    this.renderAll();
  }

  private reviewLast(): void {
    this.results = false;
    this.autoplayPrompt();
    this.renderAll();
  }

  // -- help overlay -----------------------------------------------------
  private renderHelp(): HTMLElement {
    const panel = this.panel("controls", "b-accent");
    const inner = el("div", "panel-body help");
    const sections: [string, [string, string][]][] = [
      ["Playback", [
        ["w", "play the word"],
        ["⇧ w", "play it inside a sentence"],
        ["a s d f", "play an option  (lucia)"],
        ["⇧ a/s/d/f", "play an option inside a sentence  (lucia)"],
      ]],
      ["Answering", [
        ["1 2 3 4", "type the two tones  (classic)"],
        ["⌫", "erase a digit  (classic)"],
        ["↵ / space", "submit / choose"],
        ["← / →", "previous / next question"],
      ]],
      ["Display", [
        ["c", "show / hide the question characters"],
        ["v", "show / hide the option characters  (lucia)"],
      ]],
      ["Settings", [["[ / ]", "voices in play  (1-4)"]]],
      ["Modes", [["l", "switch classic / lucia"], ["?", "toggle these controls"]]],
    ];
    for (const [title, rows] of sections) {
      inner.append(el("div", "accent bold section-title", title));
      const g = el("div", "help-grid");
      for (const [key, desc] of rows) {
        g.append(el("div", "accent right", key), el("div", "", desc));
      }
      inner.append(g);
    }
    panel.append(inner);
    return panel;
  }

  // -- footer -----------------------------------------------------------
  private renderFooter(): HTMLElement {
    const footer = el("div");
    footer.id = "footer";
    type Item = [string, string, () => void];
    let items: Item[];
    if (this.results) {
      items = [
        ["↻", "restart", () => this.restart()],
        ["←", "review", () => this.reviewLast()],
      ];
    } else if (this.lucia) {
      items = [
        ["w", "word", () => this.requestPlay(this.q.word, false)],
        ["⇧w", "sentence", () => this.requestPlay(this.q.word, true)],
        ["←", "prev", () => this.step(-1)],
        ["→", "next", () => this.step(1)],
        ["c", "chars", () => this.toggleChars()],
        ["v", "opt chars", () => this.toggleOptChars()],
        ["[", "−voice", () => this.changeVoices(-1)],
        ["]", "+voice", () => this.changeVoices(1)],
        ["l", "classic", () => this.toggleMode()],
        ["?", "help", () => this.toggleHelp()],
      ];
    } else {
      items = [
        ["w", "word", () => this.requestPlay(this.q.word, false)],
        ["⇧w", "sentence", () => this.requestPlay(this.q.word, true)],
        ["←", "prev", () => this.step(-1)],
        ["→", "next", () => this.step(1)],
        ["c", "chars", () => this.toggleChars()],
        ["[", "−voice", () => this.changeVoices(-1)],
        ["]", "+voice", () => this.changeVoices(1)],
        ["l", "lucia", () => this.toggleMode()],
        ["?", "help", () => this.toggleHelp()],
      ];
    }
    for (const [key, desc, fn] of items) {
      const b = el("button", "fbtn");
      b.append(el("span", "key", ` ${key} `), el("span", "fdesc", ` ${desc} `));
      b.onclick = fn;
      footer.append(b);
    }
    return footer;
  }

  // -- audio ------------------------------------------------------------
  private requestPlay(word: string, frame: boolean): void {
    const voice = pickVoice(word, this.numVoices, this.seed);
    play(questionClip(word, voice, frame));
    this.renderAll();
  }

  private autoplayPrompt(): void {
    this.requestPlay(this.q.word, false);
  }

  private changeVoices(delta: number): void {
    const next = Math.max(1, Math.min(MAX_VOICES, this.numVoices + delta));
    if (next === this.numVoices) {
      this.flash = `voices at ${delta < 0 ? "min" : "max"} (${this.numVoices})`;
      this.renderAll();
      return;
    }
    this.numVoices = next;
    this.requestPlay(this.q.word, false);
  }

  // -- navigation -------------------------------------------------------
  private step(dir: number): void {
    const last = this.questions.length - 1;
    if (dir > 0 && this.idx === last) {
      if (this.q.result) {
        this.results = true;
        stopPlayback();
        this.renderAll();
      }
      return;
    }
    if (dir < 0 && this.idx === 0) return;
    this.idx += dir;
    this.buffer = "";
    this.selected = null;
    this.autoplayPrompt();
  }

  // -- toggles ----------------------------------------------------------
  private toggleChars(): void { this.showChars = !this.showChars; this.renderAll(); }
  private toggleOptChars(): void { this.showOptChars = !this.showOptChars; this.renderAll(); }
  private toggleHelp(): void { this.showHelp = !this.showHelp; this.renderAll(); }
  private toggleMode(): void {
    this.lucia = !this.lucia;
    this.buffer = "";
    this.selected = null;
    this.renderAll();
  }

  // -- classic input ----------------------------------------------------
  private pushDigit(d: string): void {
    if (this.q.userAnswer !== null) return;
    if (this.buffer.length < 4) this.buffer += d;
    this.flash = "";
    this.renderAll();
  }
  private eraseDigit(): void {
    if (this.q.userAnswer !== null) return;
    this.buffer = this.buffer.slice(0, -1);
    this.renderAll();
  }
  private submit(): void {
    if (this.q.userAnswer !== null) return;
    if (!this.buffer) {
      this.flash = "type the tones first";
      this.renderAll();
      return;
    }
    const q = this.q;
    const result = judge(q.answer, this.buffer);
    q.userAnswer = this.buffer;
    q.result = result;
    q.correct = result === "correct";
    this.buffer = "";
    this.flash = "";
    this.renderAll();
  }

  // -- lucia input ------------------------------------------------------
  private selectOption(i: number): void {
    this.playOption(i, false, true);
  }
  private playOption(i: number, frame: boolean, select = false): void {
    const q = this.q;
    if (i >= q.options.length) return;
    if (select && q.userAnswer === null) this.selected = i;
    this.requestPlay(q.options[i].word, frame);
  }
  private submitLucia(): void {
    const q = this.q;
    if (!q.options.length || q.userAnswer !== null) return;
    if (this.selected === null) {
      this.flash = "pick an option first";
      this.renderAll();
      return;
    }
    const opt = q.options[this.selected];
    const result = judge(q.answer, opt.pair);
    q.userAnswer = opt.pair;
    q.selIdx = this.selected;
    q.result = result;
    q.correct = result === "correct";
    this.selected = null;
    this.flash = "";
    this.renderAll();
  }

  // -- keyboard ---------------------------------------------------------
  private onKey(e: KeyboardEvent): void {
    const key = e.key;
    this.flash = "";

    if (key === "?") { this.toggleHelp(); e.preventDefault(); return; }
    if (this.showHelp) {
      if (key === "Escape" || key === "?") this.toggleHelp();
      return;
    }

    if (this.results) {
      if (key === "r") this.restart();
      else if (key === "ArrowLeft") this.reviewLast();
      return;
    }

    if (key === "ArrowRight") { this.step(1); e.preventDefault(); return; }
    if (key === "ArrowLeft") { this.step(-1); e.preventDefault(); return; }
    if ((key === "Enter" || key === " ") && this.q.result) { this.step(1); e.preventDefault(); return; }

    if (key === "w" || key === "W") {
      const frame = key === "W";
      this.requestPlay(this.q.word, frame);
      return;
    }
    if (key === "c") { this.toggleChars(); return; }
    if (key === "l") { this.toggleMode(); return; }
    if (key === "[") { this.changeVoices(-1); return; }
    if (key === "]") { this.changeVoices(1); return; }

    if (this.lucia) this.luciaKey(key, e);
    else this.classicKey(key, e);
  }

  private luciaKey(key: string, e: KeyboardEvent): void {
    if (key === "v") { this.toggleOptChars(); return; }
    const low = key.toLowerCase();
    if (OPT_KEYS.includes(low) && this.q.options.length) {
      const i = OPT_KEYS.indexOf(low);
      if (i >= this.q.options.length) return;
      const shifted = key !== low; // uppercase letter
      this.playOption(i, shifted, true); // selects only if not yet answered
      return;
    }
    if (key === "Enter" || key === " ") { this.submitLucia(); e.preventDefault(); }
  }

  private classicKey(key: string, e: KeyboardEvent): void {
    if (this.q.userAnswer !== null) return;
    if (["1", "2", "3", "4"].includes(key)) { this.pushDigit(key); return; }
    if (key === "Backspace") { this.eraseDigit(); e.preventDefault(); return; }
    if (key === "Enter" || key === " ") { this.submit(); e.preventDefault(); }
  }
}

// -- small render helpers ------------------------------------------------
function strong(text: string): HTMLElement {
  return el("span", "bold white", text);
}
function scoreVal(text: string): HTMLElement {
  return el("span", "ok bold", text);
}
function tallyRow(n: string, cls: string, label: string): HTMLElement {
  const r = el("div", "tally-row");
  r.append(el("span", `${cls} bold right`, n), el("span", "dim", label));
  return r;
}
