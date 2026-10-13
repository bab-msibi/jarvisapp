// Runs once when the server starts
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { warmCache } = await import("./lib/server/endpoints");
  const { startSampler } = await import("./lib/server/history");
  warmCache();
  startSampler();
}
