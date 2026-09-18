/**
 * Builds the sandbox image. The build context is assembled in `.sdlc/sandbox-context`
 * (git-ignored), because one of its parts cannot be in the repository: the agent CLI, which
 * is not on the public registry and is packed here from the local install.
 *
 * The image holds every package the lockfile names, so a box installs with no network. When
 * the lockfile changes the image must be rebuilt; a box that finds its store stale says so.
 */
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { ROOT } from "../session.ts";
import { LOCAL, type LoopConfig, must, run } from "./env.ts";
import { podmanPath } from "./sandbox.ts";

const CONTEXT = join(LOCAL, "sandbox-context");

/** Where the agent CLI is installed: beside the node that runs this, unless the config says. */
function agentPackage(config: LoopConfig): string {
  const dir =
    config.sdlc.sandbox?.agent_package ??
    join(dirname(process.execPath), "node_modules", "prime-agent");
  if (!existsSync(join(dir, "package.json")))
    throw new Error(`no agent package at ${dir}; set sdlc.sandbox.agent_package in loop.json`);
  return dir;
}

function assemble(config: LoopConfig): void {
  rmSync(CONTEXT, { recursive: true, force: true });
  mkdirSync(join(CONTEXT, "manifests"), { recursive: true });
  cpSync(join(ROOT, "sdlc", "sandbox"), join(CONTEXT, "sandbox"), { recursive: true });
  for (const file of ["pnpm-lock.yaml", "pnpm-workspace.yaml", "package.json"])
    cpSync(join(ROOT, file), join(CONTEXT, "manifests", file));
  // Packing must not run the package's own prepack or prepare hooks on the host.
  const pack = ["pack", "--config.ignore-scripts=true", "--pack-destination", CONTEXT];
  must(run("pnpm", pack, { cwd: agentPackage(config) }), "pack");
  const packed = readdirSync(CONTEXT).find((f) => f.endsWith(".tgz"));
  if (!packed) throw new Error("packing the agent CLI produced no archive");
  renameSync(join(CONTEXT, packed), join(CONTEXT, "agent.tgz"));
}

export function buildSandbox(config: LoopConfig): void {
  const box = config.sdlc.sandbox;
  if (box?.kind !== "podman") throw new Error("sdlc.sandbox.kind is not `podman`");
  assemble(config);
  const manager = (
    JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      packageManager?: string;
    }
  ).packageManager;
  const pnpmVersion = manager?.startsWith("pnpm@") ? manager.slice(5) : "latest";
  // Output goes straight to the terminal: a build takes minutes and says why when it fails.
  execFileSync(
    podmanPath(box),
    [
      "build",
      "--tag",
      box.image,
      "--build-arg",
      `PNPM_VERSION=${pnpmVersion}`,
      "--file",
      join(CONTEXT, "sandbox", "Containerfile"),
      CONTEXT,
    ],
    { stdio: "inherit" },
  );
  console.log(`Built ${box.image}. Rebuild after pnpm-lock.yaml changes.`);
}
