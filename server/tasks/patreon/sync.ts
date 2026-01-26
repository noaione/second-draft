import { syncPatreon } from "~~/server/utils/patreon-sync";

/**
 * Main sync task
 */
export default defineTask({
  meta: {
    name: 'patreon:sync',
    description: 'Download Patreon posts and convert to markdown',
  },
  async run({ payload, context }) {
    return await syncPatreon();
  },
});
