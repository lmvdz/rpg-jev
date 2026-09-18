import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";

const WORLDS = join(import.meta.dirname, "public", "worlds");
const MAX_BYTES = 16 * 1024 * 1024;

/**
 * The editor's Ctrl+S: `PUT /__world/<name>` writes `public/worlds/<name>.json`,
 * so a painted world lands in the repository. Dev server only, and the name
 * can only be lowercase letters, digits and dashes, so it cannot leave the folder.
 */
function saveWorlds(): Plugin {
  return {
    name: "rpg-jev-save-worlds",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__world", (request, response) => {
        const name = /^\/([a-z0-9][a-z0-9-]{0,40})$/.exec(request.url ?? "")?.[1];
        if (request.method !== "PUT" || !name) {
          response.statusCode = 400;
          response.end("PUT /__world/<name>");
          return;
        }
        const parts: Buffer[] = [];
        let size = 0;
        request.on("data", (part: Buffer) => {
          size += part.length;
          if (size <= MAX_BYTES) parts.push(part);
        });
        request.on("end", () => {
          if (size > MAX_BYTES) {
            response.statusCode = 413;
            response.end("too large");
            return;
          }
          const text = Buffer.concat(parts).toString("utf8");
          try {
            JSON.parse(text);
          } catch {
            response.statusCode = 400;
            response.end("not JSON");
            return;
          }
          mkdir(WORLDS, { recursive: true })
            .then(() => writeFile(join(WORLDS, `${name}.json`), text))
            .then(() => response.end("saved"))
            .catch((error: unknown) => {
              response.statusCode = 500;
              response.end(String(error));
            });
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [saveWorlds()],
  server: { port: 5174, strictPort: true },
  worker: { format: "es" },
});
