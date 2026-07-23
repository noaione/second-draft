import { syncPatreon } from '../server/utils/patreon-sync';
import { syncWattpad } from '../server/utils/wattpad-sync';
import { loadConfig } from '../server/utils/config';
import { join } from 'node:path';

const rootDir = join(import.meta.dirname, '..');

(async () => {
  const config = await loadConfig(rootDir);

  if (config.patreon) {
    await syncPatreon(rootDir);
  }
  if (config.wattpad) {
    await syncWattpad(rootDir);
  }
})();
