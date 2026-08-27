"""k9s-style Textual UI for the interactive tone drill.

Kept separate from tone_drill.py so `--mode file` never needs textual.
"""

import subprocess

from rich.align import Align
from rich.console import Group
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from textual.app import App, ComposeResult
from textual.widgets import Static

# k9s-ish palette
C_KEY = "black on #50b4ff"      # highlighted shortcut key
C_ACCENT = "#50b4ff"           # cyan/blue accent
C_OK = "#79dd6f"
C_BAD = "#ff6b6b"
C_DIM = "#7c7c7c"
C_WARN = "#f2c14e"

LOGO = [
    " ┏┳┓┏━┓┏┓╻┏━╸",
    "  ┃ ┃ ┃┃┗┫┣╸ ",
    "  ╹ ┗━┛╹ ╹┗━╸",
]


def _norm(ans: str) -> str:
    """Reduce an answer to its bare tone digits: '1-4' -> '14'."""
    return "".join(ch for ch in ans if ch.isdigit())


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
        self.show_chars = True    # toggle: reveal the hanzi while answering
        self.buffer = ""          # digits typed for the current item
        self.flash = ""           # transient status line (e.g. "▶ playing")
        self._proc = None         # current ffplay process

    # -- layout -------------------------------------------------------
    def compose(self) -> ComposeResult:
        yield Static(id="header")
        yield Static(id="body")
        yield Static(id="footer")

    def on_mount(self) -> None:
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
        info.add_row("Mode:", Text("interactive", style="bold white"))
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
        lines = []

        lines.append(Text(f"Question {self.idx + 1}", style=C_DIM))
        lines.append(Text(""))
        # Hide the characters while answering for a pure by-ear test; always
        # reveal once the item is scored.
        if self.show_chars or q["user_answer"] is not None:
            lines.append(Text(q["word"], style="bold white", justify="center"))
        else:
            masked = " ".join("＿" for _ in q["word"])
            lines.append(Text(masked, style=C_DIM, justify="center"))
        lines.append(Text(""))

        if q["user_answer"] is None:
            typed = self.buffer or "—"
            lines.append(Text.assemble(
                ("Your tones  ", C_DIM),
                (typed, f"bold {C_ACCENT}"),
            ))
            lines.append(Text("(type two digits, e.g. 14, then Enter)", style=C_DIM))
        else:
            ok = q["correct"]
            verdict = "✓ correct" if ok else "✗ wrong"
            lines.append(Text(verdict, style=f"bold {C_OK if ok else C_BAD}"))
            lines.append(Text.assemble(
                ("you: ", C_DIM), (q["user_answer"], "white"),
                ("     answer: ", C_DIM), (q["answer"], f"bold {C_OK}"),
            ))

        if self.flash:
            lines.append(Text(""))
            lines.append(Text(self.flash, style=C_WARN))

        panel = Panel(
            Align.center(Group(*lines), vertical="middle"),
            border_style=C_ACCENT,
            title="tone-drill",
            title_align="left",
            padding=(1, 4),
        )
        self.query_one("#body", Static).update(panel)

    def render_footer(self):
        pairs = [
            ("w", "word"), ("s", "sentence"),
            ("c", "hide" if self.show_chars else "show"),
            ("←/→", "prev/next"), ("↵", "submit"), ("⌫", "erase"),
            ("q", "quit"),
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

    # -- input --------------------------------------------------------
    def on_key(self, event) -> None:
        key = event.key
        self.flash = ""

        if key == "q":
            self.stop_playback()
            self.exit()
            return

        if key in ("left", "right"):
            self.idx = (self.idx + (1 if key == "right" else -1)) % len(self.questions)
            self.buffer = ""
            self.render_all()
            return

        if key == "w":
            self.play(self.q["word_clip"])
            self.flash = "▶ word"
            self.render_body()
            return

        if key == "s":
            self.play(self.q["frame_clip"])
            self.flash = "▶ 请说 —— 这个词"
            self.render_body()
            return

        if key == "c":
            self.show_chars = not self.show_chars
            self.render_all()
            return

        # Answer entry — only meaningful before this item is scored.
        if self.q["user_answer"] is None:
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
                return

    def submit(self):
        if not self.buffer:
            self.flash = "type the tones first"
            self.render_body()
            return
        q = self.q
        q["user_answer"] = self.buffer
        q["correct"] = (self.buffer == _norm(q["answer"]))
        self.buffer = ""
        self.render_all()
