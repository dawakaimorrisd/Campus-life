import type { ClientMsg, Doing, HelpKind, InvitePlace, NoticeTone, PlayerState, SpotKind } from '@campus/shared';

export type ConnectionStatus = 'connecting' | 'online' | 'replaced';

export interface Toast { id: number; text: string; tone: NoticeTone }
export interface InviteInfo { id: string; fromName: string; place: InvitePlace; expiresAt: number }
export interface HelpInfo { withName: string; kind: HelpKind; role: 'helper' | 'requester'; pct: number }
export interface SpotInfo { id: string; kind: SpotKind; label: string; price: number }
export interface HistoryInfo { id: string; line: string | null; known: string | null }
export interface SelectedInfo { state: PlayerState; dist: number; sameLevel: boolean }

/** Everything the Svelte UI shows. The Phaser scene writes it; components read it. */
export const g = $state({
  status: 'connecting' as ConnectionStatus,
  zone: 'Campus grounds',
  online: 0,
  ping: null as number | null,
  selfId: null as string | null,
  money: 0,
  mischief: true,
  seated: false,
  holding: false,
  eating: false,
  asking: false,
  following: false,
  nearSeat: false,
  spot: null as SpotInfo | null,
  doing: null as Doing | null,
  watched: false,
  inClass: false,
  history: null as HistoryInfo | null,
  selected: null as SelectedInfo | null,
  toasts: [] as Toast[],
  invites: [] as InviteInfo[],
  help: null as HelpInfo | null
});

let sender: (m: ClientMsg) => void = () => {};
export const setSender = (fn: (m: ClientMsg) => void) => (sender = fn);
export const send = (m: ClientMsg) => sender(m);

let toastId = 1;
export function toast(text: string, tone: NoticeTone = 'info') {
  const id = toastId++;
  g.toasts = [...g.toasts.slice(-3), { id, text, tone }];
  setTimeout(() => (g.toasts = g.toasts.filter((t) => t.id !== id)), tone === 'fun' ? 6500 : 5000);
}

export function resetStore() {
  g.status = 'connecting';
  g.selfId = null;
  g.online = 0;
  g.selected = null;
  g.toasts = [];
  g.invites = [];
  g.help = null;
  g.seated = g.holding = g.eating = g.asking = g.following = g.nearSeat = g.watched = g.inClass = false;
  g.spot = null;
  g.doing = null;
  g.history = null;
}
