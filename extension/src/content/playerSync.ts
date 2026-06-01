export interface TimedLine {
  index: number;
  startTime: number;
  endTime: number;
}

export function activeIndexAt(lines: TimedLine[], t: number): number {
  for (const l of lines) {
    if (t >= l.startTime && t < l.endTime) return l.index;
  }
  return -1;
}

export interface PlayerSyncArgs {
  getTime: () => number;
  lines: TimedLine[];
  onChange: (index: number) => void;
}

export interface PlayerSync {
  tick: () => void;
  start: () => void;
  stop: () => void;
  currentIdx: () => number;
}

export function makePlayerSync(args: PlayerSyncArgs): PlayerSync {
  let last = -2;
  let raf: number | null = null;

  const sync: PlayerSync = {
    tick(): void {
      const idx = activeIndexAt(args.lines, args.getTime());
      if (idx !== last) {
        last = idx;
        args.onChange(idx);
      }
    },
    start(): void {
      const loop = (): void => { sync.tick(); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    },
    stop(): void {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    },
    currentIdx(): number { return last; },
  };
  return sync;
}
