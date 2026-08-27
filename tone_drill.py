#!/usr/bin/env python3
"""
Tone perception drill generator.

Two modes:

    interactive  (default)  A k9s-style terminal UI. Pick 20 names, pre-generate
                            (or reuse cached) audio for every speed/voice they
                            can reach, then work through them one at a time: play
                            the word on its own or in a 请说 —— 这个词 frame,
                            replay as needed, type the tones (e.g. `14` for 1-4)
                            and get instant scoring. `-`/`+` change the text speed
                            (±25% in 5% steps); `[`/`]` change how many voices are
                            in play (1-4, picked per word). Clips cache under
                            questions/<speed>/<voice>/.

    file                    Build a single exam-style mp3: each item read twice
                            with a short gap, then a long gap for you to write an
                            answer. Voices rotate per item. Writes a separate
                            answer key you shouldn't open until you're done.

    pip install edge-tts textual
    (ffmpeg / ffplay must be on PATH)

    python tone_drill.py                  # interactive
    python tone_drill.py --mode file      # build drill.mp3 + drill_key.txt
    python tone_drill.py --mode generate  # pre-build every clip, then exit
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
NAMES = [
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
    ("刘基", "2-1"), ("刘吉", "2-2"), ("宋濂", "4-2"), ("汤和", "1-2"),
    ("邓愈", "4-4"), ("冯胜", "2-4"), ("蓝玉", "2-4"), ("齐泰", "2-4"),
    ("铁铉", "3-4"), ("盛庸", "4-1"), ("解缙", "4-4"), ("杨荣", "2-2"),
    ("杨溥", "2-3"), ("杨涟", "2-2"), ("于谦", "2-1"), ("石亨", "2-1"),
    ("李贤", "3-2"), ("商辂", "1-4"), ("彭时", "2-2"), ("丘濬", "1-4"),
    ("王恕", "2-4"), ("王艮", "2-4"), ("毛纪", "2-4"), ("夏言", "4-2"),
    ("徐阶", "2-1"), ("徐渭", "2-4"), ("高拱", "1-3"), ("聂豹", "4-4"),
    ("薛瑄", "1-1"), ("沈度", "3-4"), ("马愉", "3-2"),
]

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
# for the full set. The interactive drill uses the first `num_voices` of these
# (see pick_voice); MAX_VOICES caps the '[' / ']' control.
VOICES = [
    "zh-CN-XiaoxiaoNeural",
    "zh-CN-XiaoyiNeural",
    "zh-CN-YunxiNeural",
    "zh-CN-YunjianNeural",
]
MAX_VOICES = len(VOICES)

RATE = "+0%"          # file-mode rate; the interactive drill sets its own (speed)
GAP_REPEAT_MS = 1500  # between the two readings of the same item
GAP_ANSWER_MS = 3000  # time to write your answer
LEAD_IN_MS = 3000     # silence before the first item
SHUFFLE = True
COUNT = 20

# Interactive text-speed control ('-' / '+'), as a percentage rate offset.
SPEED_MIN = -25
SPEED_MAX = 25
SPEED_STEP = 5
SPEED_DEFAULT = 0
VOICES_DEFAULT = 1

OUT_DIR = Path("drill_out")   # file-mode artefacts only
OUT_FILE = Path("drill.mp3")
KEY_FILE = Path("drill_key.txt")

# Interactive/Lucia clips cache here, keyed by speed then voice:
#   questions/<speed>/<voice>/<word>.mp3        (word on its own)
#   questions/<speed>/<voice>/<word>_frame.mp3  (word in the 请说 frame)
QUESTIONS_DIR = Path("questions")
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


async def synth(text: str, voice: str, path: Path, rate: str = RATE):
    await edge_tts.Communicate(text, voice, rate=rate).save(str(path))


def rate_str(speed: int) -> str:
    """Speed offset (e.g. -15) -> edge-tts rate string ('-15%')."""
    return f"{speed:+d}%"


def speed_tag(speed: int) -> str:
    """Speed offset -> path-safe folder name ('+0', '-15', '+25')."""
    return f"{speed:+d}"


def pick_voice(word: str, num_voices: int, seed) -> str:
    """Deterministically choose a voice for `word` from the first `num_voices`.

    Keyed on (word, num_voices, seed): with num_voices == 1 this is always the
    single primary voice, so dropping the count back to 1 reverts every word to
    it rather than keeping whatever a higher count had randomly assigned. Bump
    the count and the same word may land on a different voice.
    """
    n = max(1, min(num_voices, len(VOICES)))
    if n == 1:
        return VOICES[0]
    h = hashlib.md5(f"{word}|{n}|{seed}".encode()).hexdigest()
    return VOICES[int(h, 16) % n]


def question_clip(word: str, voice: str, speed: int, frame: bool = False) -> Path:
    """Cache path for an interactive/Lucia clip at a given speed and voice."""
    name = f"{word}_frame.mp3" if frame else f"{word}.mp3"
    return QUESTIONS_DIR / speed_tag(speed) / voice / name


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


def build_questions(count: int, seed):
    """Select the items and return their question dicts (no audio; clips are
    pre-generated by build_interactive_clips)."""
    items = pick_items(count, seed)
    return [
        {
            "word": word,
            "answer": answer,
            "user_answer": None,
            "correct": None,
        }
        for word, answer in items
    ]


def build_lucia_options(questions, seed):
    """Attach 4 tone-pair options to each question.

    Always at least one option matches the question's tone pair; sometimes two
    (a second word of the same pair), so the drill can reveal that more than one
    answer was correct. The rest are distinct non-matching pairs. Deterministic
    for a given (seed, index). The TUI derives each option's clip path from its
    word at play time, since the path depends on the live speed/voice settings.
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

        q["options"] = [{"pair": pair, "word": word} for pair, word in opts]


def all_speeds():
    """Every speed offset the '-' / '+' control can reach."""
    return list(range(SPEED_MIN, SPEED_MAX + 1, SPEED_STEP))


def reachable_clips(questions, seed):
    """Every (text, voice, speed, path) the interactive drill could play.

    Covers each prompt word and each Lucia option word, at every speed, for
    every voice that word can map to as the voice count runs 1..MAX_VOICES —
    so nothing is ever generated mid-drill.
    """
    words = set()
    for q in questions:
        words.add(q["word"])
        for opt in q.get("options", []):
            words.add(opt["word"])

    jobs = []
    speeds = all_speeds()
    for word in sorted(words):
        voices = {pick_voice(word, n, seed) for n in range(1, MAX_VOICES + 1)}
        for voice in voices:
            for speed in speeds:
                for frame in (False, True):
                    text = FRAME.format(word) if frame else word
                    jobs.append((text, voice, speed, question_clip(word, voice, speed, frame)))
    return jobs


def _has_clip(path: Path) -> bool:
    """True if `path` is a usable cached clip. A zero-byte file (a synth that
    failed or was interrupted mid-write) does NOT count — otherwise it would be
    treated as cached forever and never regenerated."""
    return path.exists() and path.stat().st_size > 0


def _generate(jobs, concurrency: int = 12):
    """Synthesize the missing clips in `jobs`, at most `concurrency` at a time.

    Each job is a 4-tuple ``(text, voice, speed, path)`` — the string to speak,
    the voice to use, the speed offset, and the mp3 to write. So ``job[3]`` is
    the output path; we skip jobs whose clip already exists and is non-empty.
    """
    jobs = [job for job in jobs if not _has_clip(job[3])]  # job[3] == path
    if not jobs:
        print("All clips cached.")
        return

    total = len(jobs)
    print(f"Generating {total} audio clip(s)…  (Ctrl-C to stop)")

    async def _run():
        # edge-tts is network-bound, so we fire many requests at once — but a
        # semaphore caps it at `concurrency` in flight so we don't open hundreds
        # of connections (and risk being throttled). Each `one()` waits to
        # acquire a slot, does its synth, then releases it on exit.
        sem = asyncio.Semaphore(concurrency)
        done = 0

        async def one(text, voice, speed, path):
            nonlocal done
            async with sem:  # hold one of the `concurrency` slots while synthing
                path.parent.mkdir(parents=True, exist_ok=True)
                await synth(text, voice, path, rate_str(speed))
            done += 1
            if done % 25 == 0 or done == total:
                print(f"  [{done}/{total}]")

        # Schedule every job at once; the semaphore is what actually throttles.
        await asyncio.gather(*(one(*job) for job in jobs))

    asyncio.run(_run())


def build_interactive_clips(questions, seed, concurrency: int = 12):
    """Pre-generate (or reuse) every clip this run's seed can reach."""
    _generate(reachable_clips(questions, seed), concurrency)


def all_words():
    """Every word in the corpus: classic names + Lucia dictionary."""
    words = {word for word, _ in NAMES}
    for group in LUCIA_WORDS.values():
        words.update(group)
    return words


def all_clips():
    """Every clip the drill could ever play, for any seed: the whole corpus at
    every voice and speed (voice assignment is seed-dependent, so all voices are
    covered)."""
    jobs = []
    for word in sorted(all_words()):
        for voice in VOICES:
            for speed in all_speeds():
                for frame in (False, True):
                    text = FRAME.format(word) if frame else word
                    jobs.append((text, voice, speed, question_clip(word, voice, speed, frame)))
    return jobs


def build_all_clips(concurrency: int = 12):
    """Pre-generate the entire corpus so every future run is fully cached."""
    _generate(all_clips(), concurrency)


def run_interactive(count: int, seed):
    check_bin("ffplay")
    questions = build_questions(count, seed)
    build_lucia_options(questions, seed)
    build_interactive_clips(questions, seed)
    # Imported lazily so `--mode file` doesn't require textual.
    from tui import DrillApp
    DrillApp(questions=questions, seed=seed).run()


# ----------------------------------------------------------------------
# CLI


def main():
    parser = argparse.ArgumentParser(description=__doc__.strip().splitlines()[0])
    parser.add_argument(
        "--mode", choices=("interactive", "file", "generate"), default="interactive",
        help="interactive TUI drill (default), build the exam mp3 file, or "
             "'generate' to pre-build every clip (all words/voices/speeds) and exit",
    )
    parser.add_argument("--count", type=int, default=COUNT, help="number of items")
    parser.add_argument(
        "--seed", type=int, default=None,
        help="ordering seed (default: random; reuse a printed seed to reproduce)",
    )
    args = parser.parse_args()

    if args.mode == "generate":
        build_all_clips()
        return

    if args.seed is None:
        args.seed = random.randrange(1_000_000)
    print(f"seed: {args.seed}")

    if args.mode == "file":
        run_file(args.count, args.seed)
    else:
        run_interactive(args.count, args.seed)


if __name__ == "__main__":
    main()
