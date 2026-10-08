/** Counts actual foreground playback; callers supply monotonic wall time. */
export class ViewingClock {
  durationMs = 0;
  completion = 0;
  loops = 0;
  private lastWall: number | null = null;
  private lastPosition: number | null = null;
  sample(now: number, enabled: boolean, position?: number, duration?: number) {
    if (!enabled) { this.lastWall = null; this.lastPosition = null; return; }
    if (this.lastWall !== null) {
      const elapsed = Math.max(0, Math.min(1000, now - this.lastWall));
      if (position === undefined) this.durationMs = Math.min(120000, this.durationMs + elapsed);
      else if (this.lastPosition !== null && duration && duration > 0) {
        let delta = position - this.lastPosition;
        if (delta < 0 && this.lastPosition > duration - 1.5 && position < 1.5) { delta += duration; this.loops = Math.min(2, this.loops + 1); }
        // Seeking or a stalled timer cannot manufacture watch time.
        if (delta >= 0 && delta * 1000 <= elapsed + 300) this.durationMs = Math.min(duration * 2000, 120000, this.durationMs + Math.min(elapsed, delta * 1000));
      }
    }
    if (duration && duration > 0) this.completion = Math.min(1, this.durationMs / (duration * 1000));
    this.lastWall = now; this.lastPosition = position ?? null;
  }
  snapshot() { return { durationMs: Math.floor(this.durationMs), completion: this.completion, loops: this.loops }; }
}
