# Phase 9: Social memory

**Question:** does the world remember behaviour?

The server records interactions (talked, ate together, helped, invited, followed, stole, were together) as relationships between two players. It never shows numbers. Tapping a person shows one human sentence, like "You helped them with an assignment" or "You two eat together a lot".

- When you join, you get a short recap of who you were with recently.
- When someone you are close to comes online, you get a quiet notice.
- Stored in Postgres tables `relationships` and `interactions`. Bots are never saved.
- Sentences are written from each person's point of view (helper vs helped, thief vs robbed).
