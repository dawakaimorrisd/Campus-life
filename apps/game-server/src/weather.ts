import { DAY_MS, type WeatherKind, type WeatherState } from '@campus/shared';
import type { World } from './world';

export interface WeatherOptions {
  mode?: 'auto' | 'clear' | 'rain';
  rnd?: () => number;
}

/** Weather and the hour of the day. Everyone shares both, so rain falls on everybody at once. */
export class WeatherEngine {
  private kind: WeatherKind = 'clear';
  private endsAt = 0;
  private dayStartAt = 0;
  private started = false;
  private readonly rnd: () => number;
  private readonly mode: 'auto' | 'clear' | 'rain';

  constructor(private world: World, o: WeatherOptions = {}) {
    this.rnd = o.rnd ?? Math.random;
    this.mode = o.mode ?? 'auto';
  }

  state(): WeatherState {
    return { kind: this.kind, now: this.world.now(), endsAt: this.endsAt, dayStartAt: this.dayStartAt };
  }

  private send() { this.world.broadcast({ t: 'weather', ...this.state() }); }

  private between(a: number, b: number) { return a + this.rnd() * (b - a); }

  tick(now: number) {
    if (!this.started) {
      this.started = true;
      // Begin in the morning.
      this.dayStartAt = now - DAY_MS * 0.1;
      this.kind = this.mode === 'rain' ? 'rain' : 'clear';
      this.endsAt = now + this.between(2.5, 5) * 60_000;
      return this.send();
    }
    if (now - this.dayStartAt >= DAY_MS) this.dayStartAt += DAY_MS;
    if (this.mode !== 'auto' || now < this.endsAt) return;
    // clear -> cloudy -> rain -> cloudy -> clear
    if (this.kind === 'clear') { this.kind = 'cloudy'; this.endsAt = now + this.between(20, 40) * 1000; }
    else if (this.kind === 'cloudy') {
      const wasRaining = this.lastWasRain;
      if (wasRaining) { this.kind = 'clear'; this.lastWasRain = false; this.endsAt = now + this.between(2.5, 5) * 60_000; }
      else { this.kind = 'rain'; this.lastWasRain = true; this.endsAt = now + this.between(60, 100) * 1000; }
    } else { this.kind = 'cloudy'; this.endsAt = now + this.between(15, 30) * 1000; }
    this.send();
  }
  private lastWasRain = false;
}
