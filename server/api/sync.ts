export default defineEventHandler(async (event) => {
  await runTask('patreon:sync', {});

  return {
    ok: true,
  };
});
