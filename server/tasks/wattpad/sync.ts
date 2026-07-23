import { syncWattpad } from "~~/server/utils/wattpad-sync";

/**
 * Main sync task
 */
export default defineTask({
  meta: {
    name: 'wattpad:sync',
    description: 'Download Wattpad chapters and convert to markdown',
  },
  async run({ payload, context }) {
    const rootDir = useRuntimeConfig().rootDir;
    return await syncWattpad(rootDir);
  },
});
