/**
 * Milestone J, gate J4: one command runs a fresh playable world for one fun-test session.
 *
 *   pnpm jepa:fun-test --session s01 [--mode live|shadow|off]
 *
 * It starts (or reuses) a local SpacetimeDB host on port 3088, publishes the module to a new
 * database for this session, sets the world's JEPA mode, runs the archive worker (the archive
 * is the session's recording), and serves the browser client. Open the printed address. Stop
 * with Ctrl+C; the recording stays in packages/server/.stdb/archive/.
 */
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const session = option("session", "");
const mode = option("mode", "live");
if (!/^[a-z0-9-]{1,32}$/.test(session)) {
  console.error("Usage: pnpm jepa:fun-test --session <a-z0-9-, e.g. s01> [--mode live|shadow|off]");
  process.exit(2);
}
if (!["live", "shadow", "off"].includes(mode)) {
  console.error("--mode must be live, shadow or off");
  process.exit(2);
}
const PORT = "3088";
const env = { ...process.env, RPG_WORLD_PORT: PORT, RPG_WORLD_DATABASE: `fun-${session}` };
const children = [];
const node = (script, extra = {}, argv = [], cwd = root) => {
  const child = spawn(process.execPath, [path.join(root, script), ...argv], {
    cwd,
    env: { ...env, ...extra },
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  return child;
};
const ping = async () => {
  try {
    return (await fetch(`http://127.0.0.1:${PORT}/v1/ping`)).ok;
  } catch {
    return false;
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stop = () => {
  for (const child of children.reverse()) child.kill("SIGINT");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

if (!(await ping())) {
  node("packages/server/src/local.ts");
  for (let i = 0; i < 60 && !(await ping()); i++) await sleep(500);
}
const run = (script, ...rest) => {
  const r = spawnSync(process.execPath, [path.join(root, script), ...rest], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    stop();
    process.exit(r.status ?? 1);
  }
};
run("packages/server/src/publish.ts");
const { spacetimeCli } = await import("../../../packages/server/src/cli.ts");
spawnSync(
  spacetimeCli(),
  [
    "call",
    `fun-${session}`,
    "configure_jepa",
    JSON.stringify(mode),
    "500000",
    "--server",
    `http://127.0.0.1:${PORT}`,
    "--no-config",
    "--yes",
  ],
  { stdio: "inherit" },
);
node("packages/server/src/archive.ts");
node(
  "packages/client/node_modules/vite/bin/vite.js",
  { VITE_WORLD_SERVER: `ws://127.0.0.1:${PORT}`, VITE_WORLD_DATABASE: `fun-${session}` },
  ["--host", "127.0.0.1", "--port", "5190", "--strictPort"],
  path.join(root, "packages/client"),
);
console.log(`\nFun-test session ${session}, JEPA ${mode}. Open: http://127.0.0.1:5190/?shared\n`);
