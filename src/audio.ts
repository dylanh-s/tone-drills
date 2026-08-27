// Clip playback via a single reused HTMLAudioElement (replaces ffplay).

let current: HTMLAudioElement | null = null;

export function stopPlayback(): void {
  if (current) {
    current.pause();
    current.currentTime = 0;
    current = null;
  }
}

/** Play a clip from a relative URL. Returns true if playback started. Any
 *  load/play error is swallowed so a missing clip never breaks the UI. */
export function play(path: string): boolean {
  stopPlayback();
  const audio = new Audio(path);
  current = audio;
  audio.play().catch(() => {
    /* autoplay blocked or file missing — caller shows its own flash */
  });
  return true;
}
