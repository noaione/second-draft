import { syncPatreon } from '../server/utils/patreon-sync';

(async () => {
  await syncPatreon();
})();
