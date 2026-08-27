#!/usr/bin/env python3
"""
Tone perception drill generator.

Builds a single exam-style mp3: each item read twice with a short gap,
then a long gap for you to write an answer. Voices rotate per item.
Writes a separate answer key you shouldn't open until you're done.

    pip install edge-tts
    (ffmpeg must be on PATH)

    python tone_drill.py
"""

import asyncio
import random
import subprocess
import shutil
from pathlib import Path

import edge_tts

# ----------------------------------------------------------------------
# Config

FRAME = "请说 {} 这个词"

# (word, answer) — answer is whatever you're testing: "1", "3", "3-4", etc.
SONG = [
    ("苏轼", "1-4"), ("苏辙", "1-2"), ("苏颂", "1-4"), ("曾巩", "1-3"),
    ("曾布", "1-4"), ("秦观", "2-1"), ("晏殊", "4-1"), ("张耒", "1-3"),
    ("张栻", "1-4"), ("张浚", "1-4"), ("贺铸", "4-4"), ("李纲", "3-1"),
    ("李光", "3-1"), ("李沆", "3-4"), ("李迪", "3-2"), ("李焘", "3-1"),
    ("宗泽", "1-2"), ("韩琦", "2-2"), ("寇准", "4-3"), ("丁谓", "1-4"),
    ("夏竦", "4-3"), ("富弼", "4-4"), ("刘敞", "2-3"), ("王珪", "2-1"),
    ("蔡确", "4-4"), ("章惇", "1-1"), ("朱熹", "1-1"), ("朱弁", "1-4"),
    ("陆游", "4-2"), ("尤袤", "2-4"), ("陈亮", "2-4"), ("叶适", "4-4"),
    ("赵鼎", "4-3"), ("赵葵", "4-2"), ("胡铨", "2-2"), ("汪藻", "1-3"),
    ("孙觌", "1-2"), ("洪皓", "2-4"), ("王坚", "2-1"), ("余玠", "2-4"),
    ("孟珙", "4-3"), ("杜杲", "4-3"), ("史浩", "3-4"), ("许翰", "3-4"),
    ("董槐", "3-2"),
]
 
MING = [
    ("刘基", "2-1"), ("刘吉", "2-2"), ("宋濂", "4-2"), ("汤和", "1-2"),
    ("邓愈", "4-4"), ("冯胜", "2-4"), ("蓝玉", "2-4"), ("齐泰", "2-4"),
    ("铁铉", "3-4"), ("盛庸", "4-1"), ("解缙", "4-4"), ("杨荣", "2-2"),
    ("杨溥", "2-3"), ("杨涟", "2-2"), ("于谦", "2-1"), ("石亨", "2-1"),
    ("李贤", "3-2"), ("商辂", "1-4"), ("彭时", "2-2"), ("丘濬", "1-4"),
    ("王恕", "2-4"), ("王艮", "2-4"), ("毛纪", "2-4"), ("夏言", "4-2"),
    ("徐阶", "2-1"), ("徐渭", "2-4"), ("高拱", "1-3"), ("聂豹", "4-4"),
    ("薛瑄", "1-1"), ("沈度", "3-4"), ("马愉", "3-2"),
]
 
NAMES = SONG + MING

# Standard-accent zh-CN voices. Run `edge-tts --list-voices | grep zh-CN`
# for the full set. 
VOICES = [
    "zh-CN-XiaoxiaoNeural",
    # "zh-CN-YunjianNeural",
]

RATE = "+0%"          # try "-15%" for an easier pass, "+15%" for harder
GAP_REPEAT_MS = 1500  # between the two readings of the same item
GAP_ANSWER_MS = 3000  # time to write your answer
LEAD_IN_MS = 3000     # silence before the first item
SHUFFLE = True
SEED = 123           # set an int to reproduce a given ordering
COUNT = 20

OUT_DIR = Path("drill_out")
OUT_FILE = Path("drill.mp3")
KEY_FILE = Path("drill_key.txt")

# ----------------------------------------------------------------------


def check_ffmpeg():
    if shutil.which("ffmpeg") is None:
        raise SystemExit("ffmpeg not found on PATH. Install it first.")


def make_silence(ms: int, path: Path):
    """Generate a silent mp3 matching edge-tts output params (24kHz mono)."""
    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "lavfi",
            "-i", "anullsrc=r=24000:cl=mono",
            "-t", f"{ms / 1000:.3f}",
            "-c:a", "libmp3lame", "-b:a", "48k",
            str(path),
        ],
        check=True,
    )


async def synth(text: str, voice: str, path: Path):
    await edge_tts.Communicate(text, voice, rate=RATE).save(str(path))


async def main():
    check_ffmpeg()
    OUT_DIR.mkdir(exist_ok=True)

    items = list(NAMES)
    if SHUFFLE:
        rng = random.Random(SEED)
        rng.shuffle(items)
    items = items[0:COUNT]

    gap_repeat = OUT_DIR / "_gap_repeat.mp3"
    gap_answer = OUT_DIR / "_gap_answer.mp3"
    lead_in = OUT_DIR / "_lead_in.mp3"
    make_silence(GAP_REPEAT_MS, gap_repeat)
    make_silence(GAP_ANSWER_MS, gap_answer)
    make_silence(LEAD_IN_MS, lead_in)

    concat_lines = [f"file '{lead_in.resolve()}'"]
    key_lines = []

    for i, (word, answer) in enumerate(items, start=1):
        voice = random.choice(VOICES)
        clip = OUT_DIR / f"item_{i:02d}.mp3"
        await synth(FRAME.format(word), voice, clip)
        if (i % 5 == 1):
            clip_numbering = OUT_DIR / f"numbering_{i:02d}_to_{min(len(items), i+4):02d}.mp3"
            await synth(f"Questions {i} to {min(len(items), i+4)}", "en-GB-LibbyNeural", clip_numbering)
            concat_lines += [f"file '{clip_numbering.resolve()}'"]

        # Same clip twice: both passes are acoustically identical, so you're
        # judging one token rather than averaging two renderings.
        p = clip.resolve()
        concat_lines += [
            f"file '{p}'",
            f"file '{gap_repeat.resolve()}'",
            f"file '{p}'",
            f"file '{gap_answer.resolve()}'",
        ]
        key_lines.append(f"{i:2d}. {word}\t{answer}\t[{voice}]")

    concat_txt = OUT_DIR / "concat.txt"
    concat_txt.write_text("\n".join(concat_lines) + "\n", encoding="utf-8")

    subprocess.run(
        [
            "ffmpeg", "-y", "-loglevel", "error",
            "-f", "concat", "-safe", "0",
            "-i", str(concat_txt),
            "-c:a", "libmp3lame", "-b:a", "48k",
            str(OUT_FILE),
        ],
        check=True,
    )

    KEY_FILE.write_text("\n".join(key_lines) + "\n", encoding="utf-8")
    print(f"{OUT_FILE}  ({len(items)} items)")
    print(f"{KEY_FILE}  <- don't open until you've finished")


if __name__ == "__main__":
    asyncio.run(main())
