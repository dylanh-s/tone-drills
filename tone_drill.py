#!/usr/bin/env python3
"""
Tone perception drill generator.

Two modes:

    interactive  (default)  A k9s-style terminal UI. Pick 20 names, generate
                            (or reuse cached) audio, then work through them one
                            at a time: play the word on its own or in a
                            请说 —— 这个词 frame, replay as needed, type the
                            tones (e.g. `14` for 1-4) and get instant scoring.

    file                    Build a single exam-style mp3: each item read twice
                            with a short gap, then a long gap for you to write an
                            answer. Voices rotate per item. Writes a separate
                            answer key you shouldn't open until you're done.

    pip install edge-tts textual
    (ffmpeg / ffplay must be on PATH)

    python tone_drill.py                  # interactive
    python tone_drill.py --mode file      # build drill.mp3 + drill_key.txt
"""

import argparse
import asyncio
import hashlib
import random
import shutil
import subprocess
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

# Lucia mode: 5 common daily / HSK words per disyllabic tone pair. The answer
# is the underlying (citation) tone pair. Neutral tone is written 5 and only
# ever falls on the second syllable. Manually reviewed — keep it common.
LUCIA_WORDS = {
    "1-1": ["今天", "咖啡", "飞机", "星期", "医生"],
    "1-2": ["中国", "欢迎", "生活", "家庭", "花园"],
    "1-3": ["铅笔", "身体", "开始", "方法", "工厂"],
    "1-4": ["工作", "商店", "音乐", "生日", "车站"],
    "2-1": ["时间", "房间", "明天", "阳光", "农村"],
    "2-2": ["银行", "学习", "完成", "邮局", "足球"],
    "2-3": ["啤酒", "牛奶", "白酒", "苹果", "头脑"],
    "2-4": ["学校", "结束", "邮票", "图片", "节日"],
    "3-1": ["老师", "北京", "火车", "手机", "起飞"],
    "3-2": ["美国", "语言", "旅行", "起床", "祖国"],
    "3-3": ["你好", "水果", "手表", "广场", "洗澡"],
    "3-4": ["考试", "使用", "跑步", "眼镜", "请假"],
    "4-1": ["面包", "上班", "汽车", "大家", "后天"],
    "4-2": ["复习", "上学", "面条", "大学", "后来"],
    "4-3": ["电脑", "跳舞", "报纸", "电影", "汉语"],
    "4-4": ["再见", "电话", "教室", "上课", "快乐"],
    "1-5": ["东西", "衣服", "桌子", "关系", "先生"],
    "2-5": ["觉得", "时候", "朋友", "名字", "什么"],
    "3-5": ["喜欢", "我们", "眼睛", "椅子", "耳朵"],
    "4-5": ["漂亮", "认识", "告诉", "意思", "客气"],
}

ALL_PAIRS = list(LUCIA_WORDS)

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
COUNT = 20

OUT_DIR = Path("drill_out")
OUT_FILE = Path("drill.mp3")
KEY_FILE = Path("drill_key.txt")

# Lucia mode caches its dictionary audio here, in a per-voice subfolder.
LUCIA_DIR = Path("lucia")
LUCIA_VOICE = VOICES[0]
LUCIA_OPTIONS = 4          # options shown per question
LUCIA_DOUBLE_CHANCE = 0.25  # chance a question has two correct options

# ----------------------------------------------------------------------
# Shared helpers


def check_bin(name: str):
    if shutil.which(name) is None:
        raise SystemExit(f"{name} not found on PATH. Install it first.")


def pick_items(count: int, seed, shuffle: bool = SHUFFLE):
    """Deterministically select `count` (word, answer) pairs."""
    items = list(NAMES)
    if shuffle:
        random.Random(seed).shuffle(items)
    return items[:count]


async def synth(text: str, voice: str, path: Path):
    await edge_tts.Communicate(text, voice, rate=RATE).save(str(path))


def tone_digits(pair: str) -> str:
    """'2-4' -> '24', '3-5' -> '35'. Strips any non-digit."""
    return "".join(ch for ch in pair if ch.isdigit())


def judge(answer_pair: str, guess_pair: str) -> str:
    """Score a guess against the underlying answer.

    Returns 'correct', 'sandhi', or 'wrong'. The sandhi case is a 3-3 item
    guessed as 2-3: that's how it's actually pronounced, so we flag it rather
    than call it a plain miss — but it is not counted as correct.
    """
    a, g = tone_digits(answer_pair), tone_digits(guess_pair)
    if g == a:
        return "correct"
    if a == "33" and g == "23":
        return "sandhi"
    return "wrong"


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


# ----------------------------------------------------------------------
# File mode (original behaviour)


async def _build_file(count: int, seed):
    check_bin("ffmpeg")
    OUT_DIR.mkdir(exist_ok=True)

    items = pick_items(count, seed)

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


def run_file(count: int, seed):
    asyncio.run(_build_file(count, seed))


# ----------------------------------------------------------------------
# Interactive mode (Textual TUI)


def clip_path(text: str, voice: str) -> Path:
    """Stable, cache-friendly path for a synthesized clip."""
    h = hashlib.md5(f"{voice}|{RATE}|{text}".encode()).hexdigest()[:12]
    return OUT_DIR / f"iv_{h}.mp3"


def build_questions(count: int, seed):
    """Return question dicts with (cached) clip paths, generating what's missing."""
    OUT_DIR.mkdir(exist_ok=True)
    items = pick_items(count, seed)

    questions = []
    to_make = []  # (text, path)
    for i, (word, answer) in enumerate(items):
        voice = VOICES[i % len(VOICES)]
        frame_text = FRAME.format(word)
        word_clip = clip_path(word, voice)
        frame_clip = clip_path(frame_text, voice)
        for text, path in ((word, word_clip), (frame_text, frame_clip)):
            if not path.exists():
                to_make.append((text, path))
        questions.append({
            "word": word,
            "answer": answer,
            "voice": voice,
            "word_clip": word_clip,
            "frame_clip": frame_clip,
            "user_answer": None,
            "correct": None,
        })

    if to_make:
        print(f"Generating {len(to_make)} audio clip(s)…")

        async def _gen():
            for n, (text, path) in enumerate(to_make, start=1):
                await synth(text, VOICES[0], path)
                print(f"  [{n}/{len(to_make)}] {text}")

        asyncio.run(_gen())
    else:
        print("All clips cached.")

    return questions


def lucia_clip(word: str, voice: str, frame: bool = False) -> Path:
    """Path for a Lucia dictionary clip, cached per voice."""
    name = f"{word}_frame.mp3" if frame else f"{word}.mp3"
    return LUCIA_DIR / voice / name


def build_lucia_clips(voice: str):
    """Generate (or reuse) the word + sentence clip for every dictionary word."""
    (LUCIA_DIR / voice).mkdir(parents=True, exist_ok=True)

    to_make = []  # (text, path)
    for words in LUCIA_WORDS.values():
        for word in words:
            word_clip = lucia_clip(word, voice)
            frame_clip = lucia_clip(word, voice, frame=True)
            if not word_clip.exists():
                to_make.append((word, word_clip))
            if not frame_clip.exists():
                to_make.append((FRAME.format(word), frame_clip))

    if to_make:
        print(f"Generating {len(to_make)} Lucia clip(s)…")

        async def _gen():
            for n, (text, path) in enumerate(to_make, start=1):
                await synth(text, voice, path)
                print(f"  [{n}/{len(to_make)}] {text}")

        asyncio.run(_gen())
    else:
        print("All Lucia clips cached.")


def build_lucia_options(questions, seed, voice: str):
    """Attach 4 tone-pair options to each question.

    Always at least one option matches the question's tone pair; sometimes two
    (a second word of the same pair), so the drill can reveal that more than one
    answer was correct. The rest are distinct non-matching pairs. Deterministic
    for a given (seed, index).
    """
    for idx, q in enumerate(questions):
        rng = random.Random(f"{seed}-{idx}-lucia")
        answer = q["answer"]

        pool = LUCIA_WORDS.get(answer)
        if not pool:
            q["options"] = []  # answer pair outside the dictionary; skip
            continue

        n_correct = 2 if (len(pool) >= 2 and rng.random() < LUCIA_DOUBLE_CHANCE) else 1
        correct_words = rng.sample(pool, n_correct)
        distract_pairs = rng.sample(
            [p for p in ALL_PAIRS if p != answer], LUCIA_OPTIONS - n_correct
        )

        opts = [(answer, w) for w in correct_words]
        opts += [(p, rng.choice(LUCIA_WORDS[p])) for p in distract_pairs]
        rng.shuffle(opts)

        q["options"] = [
            {
                "pair": pair,
                "word": word,
                "word_clip": lucia_clip(word, voice),
                "frame_clip": lucia_clip(word, voice, frame=True),
            }
            for pair, word in opts
        ]


def run_interactive(count: int, seed):
    check_bin("ffplay")
    questions = build_questions(count, seed)
    build_lucia_clips(LUCIA_VOICE)
    build_lucia_options(questions, seed, LUCIA_VOICE)
    # Imported lazily so `--mode file` doesn't require textual.
    from tui import DrillApp
    DrillApp(questions=questions, seed=seed).run()


# ----------------------------------------------------------------------
# CLI


def main():
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument(
        "--mode", choices=("interactive", "file"), default="interactive",
        help="interactive TUI drill (default) or build the exam mp3 file",
    )
    parser.add_argument("--count", type=int, default=COUNT, help="number of items")
    parser.add_argument(
        "--seed", type=int, default=None,
        help="ordering seed (default: random; reuse a printed seed to reproduce)",
    )
    args = parser.parse_args()

    if args.seed is None:
        args.seed = random.randrange(1_000_000)
    print(f"seed: {args.seed}")

    if args.mode == "file":
        run_file(args.count, args.seed)
    else:
        run_interactive(args.count, args.seed)


if __name__ == "__main__":
    main()
