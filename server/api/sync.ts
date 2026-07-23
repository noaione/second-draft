import { loadConfig } from "~~/server/utils/config";

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const config = await loadConfig(runtimeConfig.rootDir);

  const ran: string[] = [];
  if (config.patreon) {
    await runTask('patreon:sync', {});
    ran.push('patreon');
  }
  if (config.wattpad) {
    await runTask('wattpad:sync', {});
    ran.push('wattpad');
  }

  return {
    ok: true,
    ran,
  };
});
