"""k9s-style Textual UI for the interactive tone drill.

Kept separate from tone_drill.py so `--mode file` never needs textual.

Two answering modes, toggled live with `l`:

    classic   type the two tone digits (e.g. 14) and press Enter.
    lucia     pick from 4 played tone-pair options with a / s / d / f
              (Shift+ plays the option inside a sentence). Enter chooses.
"""

import subprocess

from rich.align import Align
from rich.console import Group
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from textual.app import App, ComposeResult
from textual.widgets import Static

from tone_drill import (
    MAX_VOICES,
    SPEED_DEFAULT,
    SPEED_MAX,
    SPEED_MIN,
    SPEED_STEP,
    VOICES_DEFAULT,
    _has_clip,
    judge,
    pick_voice,
    question_clip,
    rate_str,
    tone_digits,
)

# k9s-ish palette
C_KEY = "black on #50b4ff"      # highlighted shortcut key
C_ACCENT = "#50b4ff"           # cyan/blue accent
C_OK = "#79dd6f"
C_BAD = "#ff6b6b"
C_DIM = "#7c7c7c"
C_WARN = "#f2c14e"             # orange — sandhi
C_SEL = "black on #79dd6f"     # selected option slot (green)

OPT_KEYS = ["a", "s", "d", "f"]

# Terminals report key *presses* (with auto-repeat) but no key *release*, so
# "hold ? for help" is emulated: each '?' keeps the overlay open and (re)arms a
# timer; when the repeats stop — i.e. you let go — the timer fires and closes
# it. Must comfortably exceed the OS key-repeat interval; bump it if the overlay
# flickers while held.
HELP_HOLD_TIMEOUT = 0.5


class DrillApp(App):
    CSS = """
    Screen { background: #101418; }
    #header { height: 7; padding: 0 1; }
    #body   { height: 1fr; padding: 1 2; content-align: center middle; }
    #footer { height: 1; background: #1b2027; color: #c8c8c8; }
    """

    def __init__(self, questions, seed):
        super().__init__()
        self.questions = questions
        self.seed = seed
        self.idx = 0
        self.lucia = False        # toggle: pick-from-options mode ('l')
        self.show_chars = True     # reveal the question hanzi while answering ('c')
        self.show_opt_chars = False  # reveal the option hanzi ('v')
        self.show_help = False     # full controls overlay (hold '?')
        self._help_timer = None    # closes the overlay when '?' stops repeating
        self.buffer = ""           # digits typed for the current item (classic)
        self.selected = None       # highlighted option index (lucia)
        self.quit_armed = False    # first of the two ` presses to quit
        self.flash = ""            # transient status line (e.g. "▶ playing")
        self._proc = None          # current ffplay process
        self.speed = SPEED_DEFAULT      # text speed offset, '-' / '+' (percent)
        self.num_voices = VOICES_DEFAULT  # voices in play, '[' / ']'

    # -- layout -------------------------------------------------------
    def compose(self) -> ComposeResult:
        yield Static(id="header")
        yield Static(id="body")
        yield Static(id="footer")

    def on_mount(self) -> None:
        self._autoplay_prompt()
        self.render_all()

    # -- derived state ------------------------------------------------
    @property
    def q(self):
        return self.questions[self.idx]

    @property
    def current_voice(self):
        return pick_voice(self.q["word"], self.num_voices, self.seed)

    @property
    def answered(self):
        return sum(1 for x in self.questions if x["user_answer"] is not None)

    @property
    def score(self):
        return sum(1 for x in self.questions if x["correct"])

    # -- rendering ----------------------------------------------------
    def render_all(self):
        self.render_header()
        self.render_body()
        self.render_footer()

    def render_header(self):
        info = Table.grid(padding=(0, 1))
        info.add_column(justify="right", style=C_ACCENT)
        info.add_column()
        info.add_row("Mode:", Text("lucia" if self.lucia else "classic",
                                    style="bold white"))
        info.add_row("Voice:", Text(self.current_voice, style="white"))
        info.add_row("Speed:", Text(rate_str(self.speed), style="white"))
        info.add_row("Voices:", Text(f"{self.num_voices} / {MAX_VOICES}", style="white"))
        info.add_row("Seed:", Text(str(self.seed), style="white"))

        stats = Table.grid(padding=(0, 1))
        stats.add_column(justify="right", style=C_ACCENT)
        stats.add_column()
        stats.add_row("Item:", Text(f"{self.idx + 1} / {len(self.questions)}", style="bold white"))
        stats.add_row("Answered:", Text(f"{self.answered} / {len(self.questions)}", style="white"))
        stats.add_row("Score:", Text(f"{self.score} / {self.answered or 0}",
                                      style=f"bold {C_OK}"))

        bar = Table.grid(expand=True)
        bar.add_column()
        bar.add_column()
        bar.add_row(info, stats)
        self.query_one("#header", Static).update(bar)

    def render_body(self):
        if self.show_help:
            self.render_help()
            return
        q = self.q
        answered = q["user_answer"] is not None
        lines = [Text(f"Question {self.idx + 1}", style=C_DIM), Text("")]

        # The prompt hanzi — hidden while answering for a pure by-ear test,
        # always revealed once the item is scored.
        if self.show_chars or answered:
            lines.append(Text(q["word"], style="bold white", justify="center"))
        else:
            masked = " ".join("＿" for _ in q["word"])
            lines.append(Text(masked, style=C_DIM, justify="center"))
        lines.append(Text(""))

        if self.lucia:
            lines += self._lucia_lines(q, answered)
        else:
            lines += self._classic_lines(q, answered)

        if self.flash:
            lines += [Text(""), Text(self.flash, style=C_WARN)]

        panel = Panel(
            Align.center(Group(*lines), vertical="middle"),
            border_style=C_ACCENT,
            title="tone-drill",
            title_align="left",
            padding=(1, 4),
        )
        self.query_one("#body", Static).update(panel)

    # -- help overlay ('?') ------------------------------------------
    def _close_help(self):
        """Fired once '?' stops repeating (released)."""
        self._help_timer = None
        if self.show_help:
            self.show_help = False
            self.render_all()

    def render_help(self):
        def section(title, rows):
            grid = Table.grid(padding=(0, 2))
            grid.add_column(justify="right", style=C_ACCENT, no_wrap=True)
            grid.add_column(style="white")
            for key, desc in rows:
                grid.add_row(key, desc)
            return Group(Text(title, style=f"bold {C_ACCENT}"), grid, Text(""))

        body = Group(
            section("Playback", [
                ("w", "play the word"),
                ("⇧ w", "play it inside a sentence"),
                ("a s d f", "play an option  (lucia)"),
                ("⇧ a/s/d/f", "play an option inside a sentence  (lucia)"),
            ]),
            section("Answering", [
                ("1 2 3 4", "type the two tones  (classic)"),
                ("⌫", "erase a digit  (classic)"),
                ("↵ / space", "submit / choose"),
                ("← / →", "previous / next question"),
            ]),
            section("Display", [
                ("c", "show / hide the question characters"),
                ("v", "show / hide the option characters  (lucia)"),
            ]),
            section("Settings", [
                ("- / +", "text speed  (0% to ±25%, 5% steps)"),
                ("[ / ]", "voices in play  (1-4)"),
            ]),
            section("Modes & session", [
                ("l", "switch classic / lucia"),
                ("?", "hold to show these controls"),
                ("` `", "quit  (press twice)"),
            ]),
        )
        panel = Panel(
            Align.center(body, vertical="middle"),
            border_style=C_ACCENT,
            title="controls",
            title_align="left",
            padding=(1, 4),
        )
        self.query_one("#body", Static).update(panel)

    # -- classic answer view -----------------------------------------
    def _classic_lines(self, q, answered):
        if not answered:
            typed = self.buffer or "—"
            return [
                Text.assemble(("Your tones  ", C_DIM), (typed, f"bold {C_ACCENT}")),
                Text("(type two digits, e.g. 14, then Enter)", style=C_DIM),
            ]
        return self._verdict_lines(q)

    # -- lucia answer view -------------------------------------------
    def _lucia_lines(self, q, answered):
        options = q["options"]
        if not options:
            return [Text("no options for this pair", style=C_BAD)]

        rows = []
        for i, opt in enumerate(options):
            key = OPT_KEYS[i]
            if not answered:
                shown = opt["word"] if self.show_opt_chars else "＿ ＿"
                sel = i == self.selected
                rows.append(Text.assemble(
                    (f" {key} ", C_SEL if sel else C_KEY),
                    ("  ", ""),
                    (shown, f"bold {C_OK}" if sel else "white"),
                ))
            else:
                verdict = judge(q["answer"], opt["pair"])
                picked = (i == q["sel_idx"])
                if verdict == "correct":
                    mark, style = "✓", C_OK
                elif verdict == "sandhi":
                    mark, style = "≈", C_WARN
                elif picked:
                    mark, style = "✗", C_BAD
                else:
                    mark, style = " ", C_DIM
                rows.append(Text.assemble(
                    (f" {key} ", C_KEY),
                    (f"  {mark}  ", f"bold {style}"),
                    (f"{opt['word']}  ", f"bold {style}"),
                    (opt["pair"], style),
                ))

        if answered:
            return rows + self._verdict_lines(q)
        return rows

    # -- shared verdict / reveal -------------------------------------
    def _verdict_lines(self, q):
        lines = [Text("")]
        result = q.get("result", "correct" if q["correct"] else "wrong")

        if result == "correct":
            lines.append(Text("✓ correct", style=f"bold {C_OK}"))
        elif result == "sandhi":
            lines.append(Text("≈ sounds right, but not counted", style=f"bold {C_WARN}"))
        else:
            lines.append(Text("✗ wrong", style=f"bold {C_BAD}"))

        lines.append(Text.assemble(
            ("you: ", C_DIM), (q["user_answer"], "white"),
            ("     answer: ", C_DIM), (q["answer"], f"bold {C_OK}"),
        ))

        # When more than one option shared the answer pair, say so.
        if self.lucia and q.get("options"):
            correct = [o["word"] for o in q["options"]
                       if judge(q["answer"], o["pair"]) == "correct"]
            if len(correct) > 1:
                lines.append(Text(
                    f"both {' and '.join(correct)} were correct", style=C_DIM))

        # Any 3-3 item carries the sandhi caveat, whatever was picked.
        if tone_digits(q["answer"]) == "33":
            lines.append(Text(""))
            lines.append(Text(
                "⚠ sandhi: 3-3 is pronounced 2-3. The underlying tones are 3-3,",
                style=C_WARN))
            lines.append(Text(
                "  so 2-3 sounds right by ear but is not counted as correct.",
                style=C_WARN))
        return lines

    def render_footer(self):
        if self.lucia:
            pairs = [
                ("w", "word"), ("a/s/d/f", "options"), ("⇧", "in sentence"),
                ("←/→", "prev/next"), ("↵ / space", "choose"),
                ("l", "classic"), ("?", "help"), ("``", "quit"),
            ]
        else:
            pairs = [
                ("w", "word"), ("⇧", "in sentence"),
                ("←/→", "prev/next"), ("↵ / space", "submit"), ("⌫", "erase"),
                ("l", "lucia"), ("?", "help"), ("``", "quit"),
            ]
        t = Text(" ")
        for key, desc in pairs:
            t.append(f" {key} ", style=C_KEY)
            t.append(f" {desc}  ", style="#c8c8c8")
        self.query_one("#footer", Static).update(t)

    # -- audio --------------------------------------------------------
    def stop_playback(self):
        if self._proc and self._proc.poll() is None:
            self._proc.terminate()

    def play(self, path):
        self.stop_playback()
        self._proc = subprocess.Popen(
            ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", str(path)]
        )

    def request_play(self, word: str, frame: bool, label: str):
        """Play `word` (bare or framed) at the current speed, using the voice
        picked for the current voice count. All clips are pre-generated, so this
        just plays from the cache."""
        voice = pick_voice(word, self.num_voices, self.seed)
        path = question_clip(word, voice, self.speed, frame)
        if _has_clip(path):
            self.flash = f"▶ {label}"
            self.play(path)
        else:  # shouldn't happen after pre-generation
            self.flash = f"⚠ missing audio: {path.name}"
        self.render_body()

    def _autoplay_prompt(self):
        """Play the prompt word as the question opens."""
        self.request_play(self.q["word"], False, "word")

    # -- speed / voices ----------------------------------------------
    def change_speed(self, delta: int):
        new = max(SPEED_MIN, min(SPEED_MAX, self.speed + delta))
        if new == self.speed:
            self.flash = f"speed at {'min' if delta < 0 else 'max'} ({rate_str(self.speed)})"
            self.render_all()
            return
        self.speed = new
        self.render_all()
        # Re-play the prompt so the new speed is heard right away.
        self.request_play(self.q["word"], False, "word")

    def change_voices(self, delta: int):
        new = max(1, min(MAX_VOICES, self.num_voices + delta))
        if new == self.num_voices:
            self.flash = f"voices at {'min' if delta < 0 else 'max'} ({self.num_voices})"
            self.render_all()
            return
        self.num_voices = new
        self.render_all()
        # The prompt's voice may have changed with the count — play the new one.
        self.request_play(self.q["word"], False, "word")

    # -- input --------------------------------------------------------
    def on_key(self, event) -> None:
        key = event.key
        self.flash = ""

        # Hold '?' for the controls overlay: each press (incl. auto-repeat) keeps
        # it open and re-arms the close timer; letting go lets the timer fire.
        if key in ("question_mark", "?"):
            if self._help_timer is not None:
                self._help_timer.stop()
            self._help_timer = self.set_timer(HELP_HOLD_TIMEOUT, self._close_help)
            if not self.show_help:
                self.show_help = True
                self.render_all()
            return
        # While the overlay is up, swallow other keys so you can't answer blind.
        if self.show_help:
            return

        # Two backtick presses to quit; any other key disarms.
        if key in ("grave_accent", "`"):
            if self.quit_armed:
                self.stop_playback()
                self.exit()
                return
            self.quit_armed = True
            self.flash = "press ` again to quit"
            self.render_body()
            return
        self.quit_armed = False

        # if we have an answer picked, space takes us to the next question
        if key in ("left", "right") or (key == "space" and self.q.get("result")):
            self.idx = (self.idx + (-1 if key == "left" else 1)) % len(self.questions)
            self.buffer = ""
            self.selected = None
            self._autoplay_prompt()
            self.render_all()
            return

        # w plays the prompt word; Shift+W plays it inside a sentence.
        if key in ("w", "W"):
            frame = key == "W"
            self.request_play(self.q["word"], frame, "sentence" if frame else "word")
            return

        if key == "c":
            self.show_chars = not self.show_chars
            self.render_all()
            return

        if key == "l":
            self.lucia = not self.lucia
            self.buffer = ""
            self.selected = None
            self.render_all()
            return

        # -/+ change text speed; [/] change how many voices are in play.
        if key in ("minus", "-", "underscore", "_", "kp_subtract"):
            self.change_speed(-SPEED_STEP)
            return
        if key in ("plus", "+", "equals_sign", "equals", "=", "kp_add"):
            self.change_speed(SPEED_STEP)
            return
        if key in ("left_square_bracket", "["):
            self.change_voices(-1)
            return
        if key in ("right_square_bracket", "]"):
            self.change_voices(1)
            return

        if self.lucia:
            self._lucia_key(event, key)
        else:
            self._classic_key(key)

    def _lucia_key(self, event, key):
        q = self.q
        if key == "v":
            self.show_opt_chars = not self.show_opt_chars
            self.render_all()
            return

        # a/s/d/f play; Shift+ (A/S/D/F) plays inside the sentence. Selecting
        # is only meaningful before the item is scored, but replay stays live.
        low = key.lower()
        if low in OPT_KEYS and q["options"]:
            i = OPT_KEYS.index(low)
            if i >= len(q["options"]):
                return
            shifted = key.isupper()
            if q["user_answer"] is None:
                self.selected = i
            self.request_play(q["options"][i]["word"], shifted,
                              "sentence" if shifted else "word")
            return

        if key in ("enter", "space"):
            self.submit_lucia()

    def _classic_key(self, key):
        if self.q["user_answer"] is not None:
            return
        if key in ("1", "2", "3", "4"):
            if len(self.buffer) < 4:
                self.buffer += key
            self.render_body()
            return
        if key == "backspace":
            self.buffer = self.buffer[:-1]
            self.render_body()
            return
        if key in ("enter", "space"):
            self.submit()

    # -- scoring ------------------------------------------------------
    def submit(self):
        if not self.buffer:
            self.flash = "type the tones first"
            self.render_body()
            return
        q = self.q
        result = judge(q["answer"], self.buffer)
        q["user_answer"] = self.buffer
        q["result"] = result
        q["correct"] = (result == "correct")
        self.buffer = ""
        self.render_all()

    def submit_lucia(self):
        q = self.q
        if not q["options"] or q["user_answer"] is not None:
            return
        if self.selected is None:
            self.flash = "pick a, s, d or f first"
            self.render_body()
            return
        opt = q["options"][self.selected]
        result = judge(q["answer"], opt["pair"])
        q["user_answer"] = opt["pair"]
        q["sel_idx"] = self.selected
        q["result"] = result
        q["correct"] = (result == "correct")
        self.selected = None
        self.render_all()
