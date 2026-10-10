import {
  CAMPUS_MAP, FOOD_COOLDOWN_MS, FOOD_PRICE, GIVE_MAX, HELP_ASK_TTL_MS, HELP_FAR_GRACE_MS, HELP_KEEP_RANGE, HELP_PAIR_COOLDOWN_MS,
  HELP_REWARD, HELP_TIME_MS, INTERACT_RANGE, INVITE_RANGE, INVITE_TTL_MS, JOIN_RANGE, MISCHIEF_RANGE, MISCHIEF_SHIELD_MS,
  PRANK_PAIR_COOLDOWN_MS, STEAL_COOLDOWN_MS, STEAL_VICTIM_COOLDOWN_MS, STOLEN_HOT_MS, EMOTE_RANGE,
  PLACE_NAMES, dist, distToRect, hash01, levelAt, zoneGather,
  CHASE_BOOST, CHASE_BOOST_MS, ESCAPE_COOLDOWN_MS, ESCAPE_WINDOW_MS, INVITE_ALL_MAX, INVITE_ALL_RANGE, MOTO_SPEED, MOTO_TIME_MS,
  MUSIC_COOLDOWN_MS, MUSIC_RANGE, REPEAT_THIEF_LIMIT, REPEAT_THIEF_LOCK_MS, REPEAT_THIEF_WINDOW_MS, SNEAK_MS, SPOT_REACH,
  TILE, WORK_TIME_MS, levelOfRow, zoneAt,
  type HelpKind, type InvitePlace, type ItemKind, type ZoneId
} from '@campus/shared';
import type { ServerPlayer, World } from './world';

let nextId = 1;
const newId = (p: string) => `${p}${nextId++}`;

/** Look up a target and check range + floor. Tells the player what's wrong if not. */
function near(world: World, p: ServerPlayer, toId: string, range: number, tooFar = 'Walk closer first.'): ServerPlayer | null {
  const t = world.players.get(toId);
  if (!t || t === p) return null;
  if (levelAt(t.y) !== levelAt(p.y) || dist(p, t) > range) {
    world.notice(p, tooFar, 'warn');
    return null;
  }
  return t;
}

// ---------- invite / join ----------
export function invite(world: World, p: ServerPlayer, toId: string, place: InvitePlace, quiet = false) {
  const t = near(world, p, toId, INVITE_RANGE, 'They are too far away to invite.');
  if (!t) return;
  for (const i of world.invites.values()) if (i.from === p.id && i.to === t.id) return; // one at a time
  const now = world.now();
  const inv = { id: newId('inv'), from: p.id, to: t.id, place, expires: now + INVITE_TTL_MS };
  world.invites.set(inv.id, inv);
  world.send(t, { t: 'invite', id: inv.id, from: p.id, fromName: p.name, place, ttl: INVITE_TTL_MS });
  if (!quiet) world.notice(p, `You invited ${t.name} to come to ${PLACE_NAMES[place]}.`, 'info');
}

export function inviteReply(world: World, p: ServerPlayer, id: string, accept: boolean) {
  const inv = world.invites.get(id);
  if (!inv || inv.to !== p.id) return;
  world.invites.delete(id);
  const from = world.players.get(inv.from);
  if (!from) return;
  world.send(from, { t: 'invite_result', id, accepted: accept, name: p.name });
  if (!accept) return;
  if (inv.place === 'here') {
    world.walkTo(p, from.x, from.y, from.id);
  } else {
    const g = zoneGather(CAMPUS_MAP, inv.place, 40, () => hash01(p.id + id) );
    world.walkTo(p, g.x, g.y);
  }
  world.log('invite_accepted', from.id, p.id);
}

/** Join whatever someone is already doing: sit with them, walk with them, or stand beside them. */
export function joinIn(world: World, p: ServerPlayer, toId: string) {
  const t = near(world, p, toId, JOIN_RANGE, 'They are too far away to join.');
  if (!t) return;
  if (t.seat || t.eatingUntil > world.now()) {
    const seat = world.freeSeatNear(t.x, t.y, 150, p.id);
    if (seat && world.sit(p, seat.id, true)) {
      world.notice(p, `You joined ${t.name}.`, 'good');
      world.log('joined', p.id, t.id);
      return;
    }
    world.notice(p, 'No free seat near them. You can stand beside them.', 'info');
  } else if (t.moving || t.following) {
    if (world.follow(p, t.id, true)) { world.log('joined', p.id, t.id); return; }
  }
  const a = hash01(p.id) * Math.PI * 2;
  world.walkTo(p, t.x + Math.cos(a) * 44, t.y + Math.sin(a) * 36, t.id);
  world.log('joined', p.id, t.id);
}

// ---------- give ----------
export function give(world: World, p: ServerPlayer, toId: string, item: ItemKind | 'money', amount?: number) {
  const t = near(world, p, toId, INTERACT_RANGE);
  if (!t) return;
  if (item === 'money') {
    const n = Math.floor(amount ?? 0);
    if (!(n >= 1 && n <= GIVE_MAX)) return;
    if (p.money < n) return world.notice(p, "You don't have that much.", 'warn');
    p.money -= n;
    t.money += n;
    world.pushSelf(p);
    world.pushSelf(t);
    world.notice(p, `You gave ${t.name} ${n} LD.`, 'good');
    world.notice(t, `${p.name} gave you ${n} LD.`, 'good');
    world.log('gave_money', p.id, t.id);
  } else {
    if (p.held !== 'plate') return world.notice(p, "You're not holding any food.", 'warn');
    if (t.held) return world.notice(p, `${t.name} already has a plate.`, 'warn');
    p.held = null; p.eatingUntil = 0; p.hotFor = null;
    t.held = 'plate';
    world.pushState(p);
    world.pushState(t);
    world.notice(p, `You gave ${t.name} your plate.`, 'good');
    world.notice(t, `${p.name} gave you a plate of food.`, 'good');
    world.log('gave_food', p.id, t.id);
  }
}

export function takeFood(world: World, p: ServerPlayer) {
  if (distToRect(CAMPUS_MAP, CAMPUS_MAP.foodCounter, p.x, p.y) > 56 || levelAt(p.y) !== 'ground') {
    return world.notice(p, 'Stand in front of the serving stall to get food.', 'warn');
  }
  if (p.held) return world.notice(p, 'Your hands are full.', 'warn');
  const wait = world.cooldownLeft(p, 'food');
  if (wait > 0) return world.notice(p, 'One plate at a time. Give it a second.', 'warn');
  if (p.money < FOOD_PRICE) return world.notice(p, `A plate is ${FOOD_PRICE} LD. You are short.`, 'warn');
  p.money -= FOOD_PRICE;
  p.held = 'plate';
  world.setCooldown(p, 'food', FOOD_COOLDOWN_MS);
  world.pushState(p);
  world.pushSelf(p);
  world.notice(p, `You bought a plate for ${FOOD_PRICE} LD. Sit down to eat it.`, 'good');
}

// ---------- help ----------
export function askHelp(world: World, p: ServerPlayer, kind: HelpKind) {
  if (p.helpSessionId) return;
  p.asking = kind;
  p.askingUntil = world.now() + HELP_ASK_TTL_MS;
  world.pushState(p);
  world.log(`asked_${kind}`, p.id);
  world.notice(p, 'People nearby can see you need a hand.', 'info');
}

export function cancelHelp(world: World, p: ServerPlayer) {
  if (p.helpSessionId) return endHelp(world, p.helpSessionId, 'cancelled');
  if (p.asking) { p.asking = null; world.pushState(p); }
}

export function offerHelp(world: World, p: ServerPlayer, toId: string) {
  const t = near(world, p, toId, INTERACT_RANGE * 1.5);
  if (!t || !t.asking) return;
  if (p.helpSessionId || t.helpSessionId) return world.notice(p, 'Already busy helping.', 'warn');
  const s = { id: newId('help'), helper: p.id, requester: t.id, kind: t.asking, progress: 0, farMs: 0, lastSent: 0 };
  world.helpSessions.set(s.id, s);
  p.helpSessionId = t.helpSessionId = s.id;
  t.asking = null;
  world.pushState(t);
  world.send(p, { t: 'help_started', withId: t.id, withName: t.name, kind: s.kind, role: 'helper', total: HELP_TIME_MS });
  world.send(t, { t: 'help_started', withId: p.id, withName: p.name, kind: s.kind, role: 'requester', total: HELP_TIME_MS });
}

function endHelp(world: World, id: string, reason: string) {
  const s = world.helpSessions.get(id);
  if (!s) return;
  world.helpSessions.delete(id);
  for (const pid of [s.helper, s.requester]) {
    const pl = world.players.get(pid);
    if (!pl) continue;
    pl.helpSessionId = null;
    world.send(pl, { t: 'help_ended', reason });
  }
}

export function tickHelp(world: World, dt: number, now: number) {
  for (const s of [...world.helpSessions.values()]) {
    const h = world.players.get(s.helper);
    const r = world.players.get(s.requester);
    if (!h || !r) { endHelp(world, s.id, 'They left.'); continue; }
    if (levelAt(h.y) !== levelAt(r.y) || dist(h, r) > HELP_KEEP_RANGE) {
      s.farMs += dt * 1000;
      if (s.farMs > HELP_FAR_GRACE_MS) { endHelp(world, s.id, 'You wandered apart.'); continue; }
    } else {
      s.farMs = 0;
      s.progress += dt * 1000;
    }
    if (s.progress >= HELP_TIME_MS) {
      const key = `${h.id}|${r.id}`;
      const fresh = now - (world.helpPairs.get(key) ?? 0) > HELP_PAIR_COOLDOWN_MS;
      const reward = fresh ? HELP_REWARD : 0;
      if (fresh) world.helpPairs.set(key, now);
      h.money += reward;
      world.helpSessions.delete(s.id);
      h.helpSessionId = r.helpSessionId = null;
      world.send(h, { t: 'help_done', withName: r.name, role: 'helper', reward });
      world.send(r, { t: 'help_done', withName: h.name, role: 'requester', reward: 0 });
      world.pushSelf(h);
      world.log('helped', h.id, r.id);
      continue;
    }
    if (now - s.lastSent > 500) {
      s.lastSent = now;
      const msg = { t: 'help_progress', pct: Math.min(100, Math.round((s.progress / HELP_TIME_MS) * 100)) } as const;
      world.send(h, msg);
      world.send(r, msg);
    }
  }
}

// ---------- mischief (harmless, opt-out, never destructive) ----------
function mischiefTarget(world: World, p: ServerPlayer, toId: string): ServerPlayer | null {
  const t = near(world, p, toId, MISCHIEF_RANGE, 'Get right next to them first.');
  if (!t) return null;
  if (!p.allowMischief) { world.notice(p, 'You turned mischief off for yourself.', 'warn'); return null; }
  if (world.now() < p.mischiefLockUntil) { world.notice(p, 'People are watching you right now. Lay low for a bit.', 'warn'); return null; }
  if (!t.allowMischief) { world.notice(p, `${t.name} is not up for jokes.`, 'warn'); return null; }
  if (world.now() < t.mischiefShieldUntil) { world.notice(p, `Give ${t.name} a moment.`, 'warn'); return null; }
  return t;
}

export function steal(world: World, p: ServerPlayer, toId: string) {
  if (p.held) return world.notice(p, 'Your hands are full.', 'warn');
  const t = mischiefTarget(world, p, toId);
  if (!t) return;
  if (t.held !== 'plate') return world.notice(p, `${t.name} has no food to take.`, 'warn');
  if (world.cooldownLeft(p, 'steal') > 0) return world.notice(p, "Slow down, people are watching.", 'warn');
  if (world.cooldownLeft(t, 'robbed') > 0) return world.notice(p, `${t.name} was just robbed. Leave them alone.`, 'warn');
  const now = world.now();
  t.held = null; t.eatingUntil = 0;
  p.held = 'plate'; p.hotFor = t.id; p.hotUntil = now + STOLEN_HOT_MS;
  t.mischiefShieldUntil = now + MISCHIEF_SHIELD_MS;
  world.setCooldown(p, 'steal', STEAL_COOLDOWN_MS);
  world.setCooldown(t, 'robbed', STEAL_VICTIM_COOLDOWN_MS);
  // The victim gets a short burst of speed so the chase is a fair one.
  if (now >= t.boostUntil || t.boostMul < CHASE_BOOST) { t.boostMul = CHASE_BOOST; t.boostUntil = now + CHASE_BOOST_MS; }
  // Do it too often and the whole campus starts watching you.
  p.stealTimes = p.stealTimes.filter((x) => now - x < REPEAT_THIEF_WINDOW_MS);
  p.stealTimes.push(now);
  if (p.stealTimes.length >= REPEAT_THIEF_LIMIT) {
    p.stealTimes = [];
    p.mischiefLockUntil = now + REPEAT_THIEF_LOCK_MS;
    p.watchedUntil = now + REPEAT_THIEF_LOCK_MS;
    world.notice(p, 'Everyone has noticed. Lay low for a while.', 'warn');
  }
  world.pushState(p);
  world.pushState(t);
  world.sendNear(t, EMOTE_RANGE, { t: 'mischief', kind: 'steal', actor: p.id, victim: t.id, actorName: p.name, victimName: t.name });
  world.notice(t, `${p.name} took your food! Chase them and take it back.`, 'fun');
  world.notice(p, `You grabbed ${t.name}'s plate. Run!`, 'fun');
  world.log('stole', p.id, t.id);
}

export function reclaim(world: World, p: ServerPlayer, fromId: string) {
  const thief = world.players.get(fromId);
  if (!thief || thief.hotFor !== p.id) return;
  if (levelAt(thief.y) !== levelAt(p.y) || dist(p, thief) > MISCHIEF_RANGE) return world.notice(p, 'Get right next to them first.', 'warn');
  if (p.held) return world.notice(p, 'Your hands are full.', 'warn');
  thief.held = null; thief.eatingUntil = 0; thief.hotFor = null;
  p.held = 'plate';
  world.pushState(thief);
  world.pushState(p);
  world.sendNear(p, EMOTE_RANGE, { t: 'mischief', kind: 'reclaim', actor: p.id, victim: thief.id, actorName: p.name, victimName: thief.name });
  world.notice(p, 'Got it back!', 'good');
  world.notice(thief, `${p.name} took the plate back.`, 'fun');
  world.log('reclaimed', p.id, thief.id);
}

export function prank(world: World, p: ServerPlayer, toId: string) {
  const t = mischiefTarget(world, p, toId);
  if (!t) return;
  const now = world.now();
  p.prankTimes = p.prankTimes.filter((x) => now - x < 60_000);
  if (p.prankTimes.length >= 4) return world.notice(p, 'Easy. Let the last joke breathe.', 'warn');
  if (world.cooldownLeft(p, `prank:${t.id}`) > 0) return world.notice(p, 'You just did that one.', 'warn');
  p.prankTimes.push(now);
  world.setCooldown(p, `prank:${t.id}`, PRANK_PAIR_COOLDOWN_MS);
  t.mischiefShieldUntil = now + MISCHIEF_SHIELD_MS;
  world.sendNear(t, EMOTE_RANGE, { t: 'mischief', kind: 'prank', actor: p.id, victim: t.id, actorName: p.name, victimName: t.name });
  world.notice(t, `${p.name} just got you 😂`, 'fun');
  world.log('pranked', p.id, t.id);
}

export function settings(world: World, p: ServerPlayer, mischief: boolean) {
  p.allowMischief = mischief;
  world.pushSelf(p);
}

export function onPlayerLeft(world: World, p: ServerPlayer) {
  for (const [id, i] of world.invites) if (i.from === p.id || i.to === p.id) world.invites.delete(id);
  if (p.helpSessionId) endHelp(world, p.helpSessionId, 'They left.');
  for (const o of world.players.values()) {
    if (o.following === p.id) { o.following = null; o.path = []; world.pushState(o); }
  }
}


// ---------- groups (Phase 5) ----------
/** "Who going Student Center?" Call everyone close enough in one go. */
export function inviteAll(world: World, p: ServerPlayer, place: InvitePlace) {
  const targets = [...world.players.values()]
    .filter((o) => o !== p && levelAt(o.y) === levelAt(p.y) && dist(p, o) <= INVITE_ALL_RANGE)
    .slice(0, INVITE_ALL_MAX);
  if (!targets.length) return world.notice(p, 'Nobody is close enough to call.', 'warn');
  for (const t of targets) invite(world, p, t.id, place, true);
  world.notice(p, `You called ${targets.length} ${targets.length === 1 ? 'person' : 'people'} to ${PLACE_NAMES[place]}.`, 'info');
}

// ---------- spots: food, music, moto, jobs (Phase 7) ----------
export function useSpot(world: World, p: ServerPlayer, spotId: string) {
  const spot = CAMPUS_MAP.spots.find((s) => s.id === spotId);
  if (!spot) return;
  if (levelAt(p.y) !== levelOfRow(spot.rect.y) || distToRect(CAMPUS_MAP, spot.rect, p.x, p.y) > SPOT_REACH) {
    return world.notice(p, 'Walk up to it first.', 'warn');
  }
  const now = world.now();
  const pay = () => {
    if (p.money < spot.price) {
      world.notice(p, `That is ${spot.price} LD. You are short.`, 'warn');
      return false;
    }
    p.money -= spot.price;
    world.pushSelf(p);
    return true;
  };
  switch (spot.kind) {
    case 'food':
      return takeFood(world, p);
    case 'music': {
      if (now - (world.spotUsedAt.get(spot.id) ?? -Infinity) < MUSIC_COOLDOWN_MS) return world.notice(p, 'Music is already on. Give it a minute.', 'warn');
      if (!pay()) return;
      world.spotUsedAt.set(spot.id, now);
      const cx = (spot.rect.x + spot.rect.w / 2) * TILE;
      const cy = (spot.rect.y + spot.rect.h / 2) * TILE;
      for (const o of world.players.values()) {
        if (levelAt(o.y) !== levelAt(cy) || Math.hypot(o.x - cx, o.y - cy) > MUSIC_RANGE || o.seat) continue;
        world.sendNear(o, 640, { t: 'emote', id: o.id, kind: 'dance' });
      }
      world.notice(p, 'You put some music on. Everyone is dancing.', 'good');
      world.log('played_music', p.id);
      return;
    }
    case 'moto': {
      if (p.doing === 'ride') return world.notice(p, 'You are already riding.', 'warn');
      if (!pay()) return;
      world.stand(p);
      p.doing = 'ride';
      p.doingUntil = now + MOTO_TIME_MS;
      p.boostMul = MOTO_SPEED;
      p.boostUntil = p.doingUntil;
      world.pushState(p);
      world.notice(p, 'Hold on. Tap anywhere to ride.', 'fun');
      world.log('rode', p.id);
      return;
    }
    case 'work': {
      if (p.doing) return world.notice(p, 'You are busy right now.', 'warn');
      const wait = world.cooldownLeft(p, `work:${spot.id}`);
      if (wait > 0) return world.notice(p, `Take a break. You can do this again in ${Math.ceil(wait / 1000)}s.`, 'warn');
      world.stand(p);
      world.stopFollowing(p, false);
      p.path = [];
      p.dirX = 0;
      p.dirY = 0;
      p.doing = 'work';
      p.workSpot = spot.id;
      p.doingUntil = now + WORK_TIME_MS;
      world.pushState(p);
      world.notice(p, `${spot.label}. Stay put for a few seconds.`, 'info');
      return;
    }
  }
}

// ---------- mischief: slipping out of class (Phase 8) ----------
const CLASS_ZONES: ZoneId[] = ['classroom_a', 'classroom_b', 'student_hall'];

export function escape(world: World, p: ServerPlayer) {
  const zone = zoneAt(CAMPUS_MAP, p.x, p.y)?.id;
  if (!zone || !CLASS_ZONES.includes(zone)) return world.notice(p, 'You can only slip out of a class.', 'warn');
  if (world.cooldownLeft(p, 'escape') > 0) return world.notice(p, 'Wait a bit before sneaking out again.', 'warn');
  const now = world.now();
  world.setCooldown(p, 'escape', ESCAPE_COOLDOWN_MS);
  // Anyone following you out the door is part of the escape.
  const crew = [...world.players.values()].filter((o) => o.following === p.id && zoneAt(CAMPUS_MAP, o.x, o.y)?.id === zone);
  const recent = (world.escapes.get(zone) ?? []).filter((e) => now - e.t < ESCAPE_WINDOW_MS && e.id !== p.id);

  const g = zoneGather(CAMPUS_MAP, 'palaver_hut', 60);
  world.walkTo(p, g.x, g.y);
  p.doing = 'sneak';
  p.doingUntil = now + SNEAK_MS;
  world.pushState(p);
  world.notice(p, crew.length ? 'You slipped out, and they came with you.' : 'You slipped out.', 'fun');
  for (const c of crew) world.notice(c, `You slipped out with ${p.name}.`, 'fun');

  world.escapes.set(zone, [...recent, { id: p.id, t: now }]);
  const partners = new Set<string>([...crew.map((c) => c.id), ...recent.map((e) => e.id)]);
  for (const id of partners) world.log('escaped_together', p.id, id);
  if (partners.size > 0) {
    world.events.emit('escape', `A group just left ${PLACE_NAMES[zone]} together`, p, { key: `escape:${zone}`, cooldownMs: 60_000, priority: true });
  } else world.log('escaped', p.id);
}

// ---------- memory: what do we know about each other (Phases 9, 10) ----------
export function peek(world: World, p: ServerPlayer, id: string) {
  const t = world.players.get(id);
  if (!t || t === p || world.cooldownLeft(p, 'peek') > 0) return;
  world.setCooldown(p, 'peek', 300);
  world.send(p, { t: 'history', id, line: world.memory.line(p.id, id), known: world.chichi.knownAs(id) });
}
