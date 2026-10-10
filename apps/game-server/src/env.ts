import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// Load the single .env at the repo root (apps/game-server/src -> ../../../.env).
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
