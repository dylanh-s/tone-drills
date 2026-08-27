// Pure drill logic, ported from tone_drill.py.
import { ALL_PAIRS, FRAME, LUCIA_DOUBLE_CHANCE, LUCIA_OPTIONS, LUCIA_WORDS, NAMES, SPEED_TAG, VOICES, } from "./data.js";
import { hashStr, Rng } from "./rng.js";
/** '2-4' -> '24', '3-5' -> '35'. Strips any non-digit. */
export function toneDigits(pair) {
    return pair.replace(/\D/g, "");
}
/** Score a guess against the underlying answer.
 *  A 3-3 item guessed as 2-3 is flagged 'sandhi' (sounds right, not counted). */
export function judge(answerPair, guessPair) {
    const a = toneDigits(answerPair);
    const g = toneDigits(guessPair);
    if (g === a)
        return "correct";
    if (a === "33" && g === "23")
        return "sandhi";
    return "wrong";
}
/** Deterministically choose a voice for `word` from the first `numVoices`.
 *  With numVoices === 1 this is always VOICES[0], mirroring the CLI. */
export function pickVoice(word, numVoices, seed) {
    const n = Math.max(1, Math.min(numVoices, VOICES.length));
    if (n === 1)
        return VOICES[0];
    const h = hashStr(`${word}|${n}|${seed}`);
    return VOICES[h % n];
}
/** Cache path (relative URL) for a clip at the fixed speed and a given voice. */
export function questionClip(word, voice, frame = false) {
    const name = frame ? `${word}_frame.mp3` : `${word}.mp3`;
    return `questions/${SPEED_TAG}/${voice}/${encodeURIComponent(name)}`;
}
/** Deterministically select `count` (word, answer) pairs for a seed. */
export function pickItems(count, seed) {
    const items = NAMES.map((p) => [p[0], p[1]]);
    new Rng(seed).shuffle(items);
    return items.slice(0, count);
}
export function buildQuestions(count, seed) {
    return pickItems(count, seed).map(([word, answer]) => ({
        word,
        answer,
        userAnswer: null,
        correct: null,
        options: [],
    }));
}
/** Attach up to 4 tone-pair options to each question. At least one option
 *  matches; sometimes two. The rest are distinct non-matching pairs. */
export function buildLuciaOptions(questions, seed) {
    questions.forEach((q, idx) => {
        const rng = new Rng(`${seed}-${idx}-lucia`);
        const answer = q.answer;
        const pool = LUCIA_WORDS[answer];
        if (!pool) {
            q.options = [];
            return;
        }
        const nCorrect = pool.length >= 2 && rng.random() < LUCIA_DOUBLE_CHANCE ? 2 : 1;
        const correctWords = rng.sample(pool, nCorrect);
        const distractPairs = rng.sample(ALL_PAIRS.filter((p) => p !== answer), LUCIA_OPTIONS - nCorrect);
        const opts = correctWords.map((w) => ({ pair: answer, word: w }));
        for (const p of distractPairs) {
            opts.push({ pair: p, word: rng.choice(LUCIA_WORDS[p]) });
        }
        rng.shuffle(opts);
        q.options = opts;
    });
}
export function framed(word) {
    return FRAME.replace("{}", word);
}
