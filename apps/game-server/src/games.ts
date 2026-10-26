import { CAMPUS_MAP, CAROUSEL_MAX, CAROUSEL_PRICE, GAME_ZONES, levelAt, zoneAt, type GameId, type GamesState, type Team } from '@campus/shared';
import type { ServerPlayer, World } from './world';

/**
 * The Games desk: one place that shows every Recreation Ground game, who is in it, and lets you join with one tap.
 * Every game has a hard limit (4 a side, 6 runners, 6 riders), a waiting list, and you can only be in one game at a time.
 */
export class GamesHub {
  constructor(private world: World) {}

  inArea(p: ServerPlayer) {
    if (levelAt(p.y) !== 'ground') return false;
    const z = zoneAt(CAMPUS_MAP, p.x, p.y)?.id;
    return !!z && (GAME_ZONES as readonly string[]).includes(z);
  }

  /** The carousel stands just north of the track: being next to it is enough to ride. */
  nearCarousel(p: ServerPlayer) {
    const r = CAMPUS_MAP.spots.find((s) => s.id === 'carousel')?.rect;
    if (!r) return false;
    const t = CAMPUS_MAP.tile;
    const x = p.x / t, y = p.y / t;
    return levelAt(p.y) === 'ground' && x >= r.x - 3 && x <= r.x + r.w + 3 && y >= r.y - 3 && y <= r.y + r.h + 3;
  }

  state(): GamesState {
    return { football: this.world.football.state(), carousel: { riders: this.world.carousel.riders, max: CAROUSEL_MAX, fare: CAROUSEL_PRICE } };
  }
  broadcast() { this.world.broadcast({ t: 'games', ...this.state() }); }
  sendTo(p: ServerPlayer) { this.world.send(p, { t: 'games', ...this.state() }); this.world.race.sendTo(p); }

  /** Standing at the desk, the start line or the carousel. */
  open(p: ServerPlayer) {
    this.sendTo(p);
    this.world.send(p, { t: 'open', what: 'games' });
  }

  private current(p: ServerPlayer): GameId | null {
    if (this.world.football.inGame(p.id)) return 'football';
    if (this.world.race.inRace(p.id)) return 'race';
    if (p.doing === 'spin') return 'carousel';
    return null;
  }

  join(p: ServerPlayer, game: GameId, team?: Team) {
    if (!(this.inArea(p) || (game === 'carousel' && this.nearCarousel(p)))) return this.world.notice(p, 'Go to the Recreation Ground to play.', 'warn');
    const cur = this.current(p);
    if (cur && cur !== game) return this.world.notice(p, `You are already in the ${cur === 'football' ? 'football match' : cur === 'race' ? 'race' : 'carousel ride'}. Leave it first.`, 'warn');
    if (p.doing && p.doing !== 'dance') return this.world.notice(p, 'Finish what you are doing first.', 'warn');
    if (game === 'football') return this.world.football.join(p, team);
    if (game === 'race') return this.world.race.join(p);
    if (this.world.carousel.riders >= CAROUSEL_MAX) return this.world.notice(p, 'The carousel is full. Try again in a few seconds.', 'warn');
    if (p.money < CAROUSEL_PRICE) return this.world.notice(p, `The fare is ${CAROUSEL_PRICE} LD. You are short.`, 'warn');
    p.money -= CAROUSEL_PRICE;
    this.world.pushSelf(p);
    this.world.carousel.ride(p);
    this.broadcast();
  }

  leave(p: ServerPlayer, game: GameId) {
    if (game === 'football') this.world.football.leave(p);
    else if (game === 'race') this.world.race.leave(p);
    else if (p.doing === 'spin') this.world.cancelDoing(p);
  }

  removed(id: string) {
    this.world.football.removed(id);
    this.world.race.removed(id);
  }
}
