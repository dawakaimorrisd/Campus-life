# Protocol

JSON over WebSocket. Types live in `packages/shared/src/protocol.ts`; the server validates every
client message with `parseClientMsg` and ignores anything malformed.

## Connecting

1. Client opens the socket and sends `join { playerId, name, avatar }` within 10 seconds.
2. Server replies `welcome` with everyone currently online and the player's private `self` state.
3. A second connection with the same `playerId` replaces the first (the old one closes with code 4001).

## Client to server

| Message | Meaning | Main server checks |
|---|---|---|
| `move_to {x,y}` / `dir {x,y}` | Walk (click or keyboard) | Collision, A* path, cancels seat and follow |
| `sit {seat}` / `stand` | Sit down, stand up | Seat free, same floor, within 480 px |
| `say {text, q?}` | Nearby talk | 6 per 8 s, 120 chars, range and floor |
| `whisper {to,text}` | Private message | Any distance, same rate limit |
| `emote {kind}` | wave, laugh, point, clap, dance, shake, think | 0.7 s cooldown |
| `invite {to,place}` / `invite_reply {id,accept}` | Ask someone to come to a place or to you | Within 640 px, expires in 20 s |
| `follow {to}` / `unfollow` | Walk with someone | Within 480 px, no loops, max 6 followers each |
| `join_in {to}` | Sit with, walk with, or stand beside someone | Within 640 px |
| `give {to,item,amount?}` | Give money (1 to 500) or your plate | Within 3 tiles |
| `take_food` | Buy a plate for 10 LD | Near the stall, hands free, 8 s cooldown |
| `ask_help {kind}` / `cancel_help` / `offer_help {to}` | Help sessions | See Phase 4 |
| `steal {to}` / `reclaim {from}` / `prank {to}` / `settings {mischief}` | Mischief | See Phase 4, 8 |
| `invite_all {place}` | Invite everyone nearby | Within 10 tiles, max 8, same floor |
| `use_spot {spot}` | Food, music, moto or work at a spot | Within 56 px, price, cooldowns |
| `escape` | Slip out of class | In a class zone, 60 s cooldown |
| `cancel_activity` | Stop working or riding | None |
| `peek {id}` | Ask what you remember about a person | Answered with `history` |

## Server to client

`welcome`, `player_joined`, `player_left`, `player_state` (seat, held, following, eating, asking),
`snap` (movement of the players who changed), `self` (money, mischief), `speech`, `whisper`,
`emote`, `invite`, `invite_result`, `help_started`, `help_progress`, `help_done`, `help_ended`,
`mischief`, `groups` (clusters of 3+), `campus_event` (text, place, kind), `history` (memory sentence, known-for label), `notice`, `pong`, `error`.
Player state also has `doing` (work, ride, sneak) and `watched`. Buzz is never sent as numbers.

## Error handling

Rejections are explained to the player in plain words through `notice` (for example "Someone is
already sitting there"), never silently.
