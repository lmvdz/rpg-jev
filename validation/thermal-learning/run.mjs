/**
 * Optional no-install launcher for an unprovisioned agent checkout.
 * Reads only the existing core dependency explicitly selected by the operator.
 * No package-manager invocation, dependency copying/linking, or fallback download.
 */
import { createRequire, registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const option = process.argv.find((arg) => arg.startsWith("--dependency-root="));
if (option) {
  const root = option.slice("--dependency-root=".length);
  if (!root) throw new Error("--dependency-root requires an existing provisioned checkout.");
  const require = createRequire(resolve(root, "packages", "core", "package.json"));
  // Resolve before installing the hook: resolving inside the hook recurses.
  const zod = pathToFileURL(require.resolve("zod")).href;
  registerHooks({
    resolve(specifier, context, next) {
      return next(specifier === "zod" ? zod : specifier, context);
    },
  });
}
if (process.argv.includes("--validate")) {
  await import("./validate.ts");
} else {
  if (!process.argv.includes("--bench")) process.argv.push("--bench");
  await import("../../packages/terminal/src/play.ts");
}
