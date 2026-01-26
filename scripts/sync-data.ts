import { syncPatreon } from '../server/utils/patreon-sync';
import { join } from 'node:path';

const rootDir = join(import.meta.dirname, '..');

(async () => {
  await syncPatreon(rootDir);
})();
