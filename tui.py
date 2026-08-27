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

from tone_drill import judge, tone_digits

# k9s-ish palette
C_KEY = "black on #50b4ff"      # highlighted shortcut key
C_ACCENT = "#50b4ff"           # cyan/blue accent
C_OK = "#79dd6f"
C_BAD = "#ff6b6b"
C_DIM = "#7c7c7c"
C_WARN = "#f2c14e"             # orange — sandhi
C_SEL = "black on #79dd6f"     # selected option slot (green)

OPT_KEYS = ["a", "s", "d", "f"]

LOGO = [
    " ┏┳┓┏━┓┏┓╻┏━╸",
    "  ┃ ┃ ┃┃┗┫┣╸ ",
    "  ╹ ┗━┛╹ ╹┗━╸",
]


class DrillApp(App):
    CSS = """
    Screen { background: #101418; }
    #header { height: 5; padding: 0 1; }
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
        self.buffer = ""           # digits typed for the current item (classic)
        self.selected = None       # highlighted option index (lucia)
        self.quit_armed = False    # first of the two ` presses to quit
        self.flash = ""            # transient status line (e.g. "▶ playing")
        self._proc = None          # current ffplay process

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
        info.add_row("Voice:", Text(self.q["voice"], style="white"))
        info.add_row("Seed:", Text(str(self.seed), style="white"))

        stats = Table.grid(padding=(0, 1))
        stats.add_column(justify="right", style=C_ACCENT)
        stats.add_column()
        stats.add_row("Item:", Text(f"{self.idx + 1} / {len(self.questions)}", style="bold white"))
        stats.add_row("Answered:", Text(f"{self.answered} / {len(self.questions)}", style="white"))
        stats.add_row("Score:", Text(f"{self.score} / {self.answered or 0}",
                                      style=f"bold {C_OK}"))

        logo = Text("\n".join(LOGO), style=f"bold {C_ACCENT}")

        bar = Table.grid(expand=True)
        bar.add_column()
        bar.add_column()
        bar.add_column(justify="right")
        bar.add_row(info, stats, logo)
        self.query_one("#header", Static).update(bar)

    def render_body(self):
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
                ("v", "hide" if self.show_opt_chars else "reveal"),
                ("←/→", "prev/next"), ("↵", "choose"),
                ("l", "classic"), ("``", "quit"),
            ]
        else:
            pairs = [
                ("w", "word"), ("⇧", "in sentence"),
                ("c", "hide" if self.show_chars else "show"),
                ("←/→", "prev/next"), ("↵", "submit"), ("⌫", "erase"),
                ("l", "lucia"), ("``", "quit"),
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

    def _autoplay_prompt(self):
        """Play the prompt word as the question opens."""
        self.play(self.q["word_clip"])
        self.flash = "▶ word"

    # -- input --------------------------------------------------------
    def on_key(self, event) -> None:
        key = event.key
        self.flash = ""

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

        if key in ("left", "right"):
            self.idx = (self.idx + (1 if key == "right" else -1)) % len(self.questions)
            self.buffer = ""
            self.selected = None
            self._autoplay_prompt()
            self.render_all()
            return

        # w plays the prompt word; Shift+W plays it inside a sentence.
        if key in ("w", "W"):
            frame = key == "W"
            self.play(self.q["frame_clip" if frame else "word_clip"])
            self.flash = "▶ sentence" if frame else "▶ word"
            self.render_body()
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
            self.play(q["options"][i]["frame_clip" if shifted else "word_clip"])
            self.flash = "▶ sentence" if shifted else "▶ word"
            self.render_body()
            return

        if key == "enter":
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
        if key == "enter":
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
