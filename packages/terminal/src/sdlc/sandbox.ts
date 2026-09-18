/**
 * Where repository code and tool-using models run: inside a Podman container that holds a
 * copy of the issue's tree and nothing else (docs/sdlc.md, "The sandbox").
 *
 * The rule is that nothing a model touched is ever executed on the host. A tree goes in as a
 * `git archive` stream. The agent works on that copy. The only thing that comes out is a text
 * patch, which code applies, checks against the bounds, and gates in a second container that
 * has no network at all. No host path is ever mounted and no credential is ever inside a box
 * that holds a tree: the model router's key lives in the relay, which adds it to each request,
 * so a model cannot read it, and cannot write it into the patch that leaves.
 *
 * The first half of this file is pure and tested: which flags a container gets, and whether
 * the tool stages may run at all. The second half drives `podman`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface SandboxConfig {
  /** `podman`, or `none` for a machine where isolation is provided some other way. */
  kind: "podman" | "none";
  /** With `kind: "none"`, tool stages run only if a person has written this exact sentence. */
  accept?: string;
  /** The podman executable, if it is not on the PATH. */
  podman?: string;
  /** The directory of the agent CLI package, if it is not installed beside node. */
  agent_package?: string;
  image: string;
  /** The port of the model router on the host: the one place the agent may reach. */
  model_port: number;
  cpus: number;
  memory_mb: number;
  pids: number;
}

export const ACCEPTANCE = "I accept that plan and build run unsandboxed on this machine";

/** Tool stages need two decisions by a person: that they may run, and where. */
export function toolStagesAllowed(sdlc: { allow_tool_stages?: boolean; sandbox?: SandboxConfig }): {
  ok: boolean;
  why: string;
} {
  if (sdlc.allow_tool_stages !== true)
    return { ok: false, why: "`sdlc.allow_tool_stages` is off in playtests/loop.json" };
  const box = sdlc.sandbox;
  if (!box) return { ok: false, why: "`sdlc.sandbox` is not configured" };
  if (box.kind === "podman") return { ok: true, why: "podman" };
  if (box.accept === ACCEPTANCE) return { ok: true, why: "unsandboxed, accepted by a person" };
  return { ok: false, why: "`sdlc.sandbox.kind` is `none` and `accept` does not say so in full" };
}

export type Profile = "agent" | "gate" | "relay";

/** Everything the loop creates in the container engine carries this, and only that is ever swept. */
export const OWNED = "io.rpg-jev.sdlc=loop";

/** One writable volume, seeded from the image: the package store, the agent's config, the tree. */
export const HOME = "/home/agent";
export const WORK = `${HOME}/work`;

/**
 * The flags a container is created with. Everything here narrows: no capability, no new
 * privilege, a read-only root, bounded processes, memory and CPU, and a network that leads
 * either nowhere (gate) or to the relay alone (agent). There is deliberately no way to pass a
 * host path: the word `--volume` appears once, without a source, for scratch space.
 */
export function containerFlags(
  profile: Profile,
  box: SandboxConfig,
  names: { container: string; internal: string },
): string[] {
  const flags = [
    "--name",
    names.container,
    "--label",
    OWNED,
    "--cap-drop=all",
    "--security-opt=no-new-privileges",
    "--read-only",
    "--tmpfs",
    "/tmp:rw,exec,size=1g",
    `--pids-limit=${box.pids}`,
    `--memory=${box.memory_mb}m`,
    `--cpus=${box.cpus}`,
    "--user",
    "1000:1000",
    "--env",
    `HOME=${HOME}`,
  ];
  if (profile === "relay") {
    // One leg on the closed network, one on the default, and one job: a TCP pipe to one port.
    flags.push("--network", `${names.internal},podman`, "--network-alias", "relay");
    return flags;
  }
  flags.push("--volume", HOME, "--workdir", WORK);
  flags.push("--network", profile === "gate" ? "none" : names.internal);
  return flags;
}

/** The model router as the agent sees it: the relay, and nothing behind it. */
export const routerUrl = (box: SandboxConfig): string => `http://relay:${box.model_port}/v1`;

/** What the agent's config holds where a key would be. The relay replaces it on the way out. */
export const NO_KEY = "held-by-the-relay";

/** The provider entry the agent is given. Only the model it was told to use is listed. */
export function agentModels(box: SandboxConfig, provider: string, model: string): string {
  const apiKey = NO_KEY;
  const entry = {
    id: model,
    name: model,
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200_000,
    maxTokens: 32_000,
  };
  const providers = {
    [provider]: { baseUrl: routerUrl(box), api: "openai-completions", apiKey, models: [entry] },
  };
  return JSON.stringify({ providers }, null, 1);
}

// --- Driving podman ------------------------------------------------------------------------

const BIG = 1024 * 1024 * 1024;

export interface Ran {
  ok: boolean;
  out: string;
}

/** The executable: what the config says, else the installer's default on Windows, else the PATH. */
export function podmanPath(box: SandboxConfig): string {
  if (box.podman) return box.podman;
  const installed = "C:/Program Files/RedHat/Podman/podman.exe";
  return process.platform === "win32" && existsSync(installed) ? installed : "podman";
}

function podman(box: SandboxConfig, args: readonly string[], input?: Buffer | string): Ran {
  try {
    const out = execFileSync(podmanPath(box), [...args], {
      encoding: "utf8",
      maxBuffer: BIG,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 60 * 60_000,
      ...(input === undefined ? {} : { input }),
    });
    return { ok: true, out };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` || (e.message ?? "failed") };
  }
}

function must(ran: Ran, what: string): string {
  if (!ran.ok) throw new Error(`${what} failed:\n${ran.out.slice(-2000)}`);
  return ran.out;
}

/** The key of the model router, from the agent CLI's own config on the host. Never logged. */
export function routerKey(provider: string): string {
  const file = join(homedir(), ".prime", "agent", "models.json");
  const config = JSON.parse(readFileSync(file, "utf8")) as {
    providers?: Record<string, { apiKey?: string }>;
  };
  const key = config.providers?.[provider]?.apiKey;
  if (!key) throw new Error(`no apiKey for provider ${provider} in ${file}`);
  return key;
}

export interface Box {
  exec(command: readonly string[], input?: Buffer | string): Ran;
  /** Everything that changed in the working tree since the tree went in, as one binary-safe patch. */
  patch(): string;
  close(): void;
}

/**
 * Starts a container for one stage of one issue, with `tree` (a directory that is a git
 * checkout on the host) copied in as of `treeish`. Dependencies are installed from the store
 * baked into the image, offline, without lifecycle scripts.
 */
export function openBox(
  box: SandboxConfig,
  profile: "agent" | "gate",
  o: { id: string; tree: string; treeish: string; provider?: string },
): Box {
  const names = { container: `sdlc-${o.id}-${profile}`, internal: `sdlc-${o.id}-net` };
  const relay = `sdlc-${o.id}-relay`;
  const close = (): void => {
    podman(box, ["rm", "--force", "--volumes", "--ignore", names.container, relay]);
    podman(box, ["network", "rm", "--force", names.internal]);
  };
  close();
  try {
    if (profile === "agent") {
      must(
        podman(box, ["network", "create", "--internal", "--label", OWNED, names.internal]),
        "network create",
      );
      const pipe = ["node", "/opt/sdlc/relay.mjs", String(box.model_port)];
      must(
        podman(box, [
          "run",
          "--detach",
          ...containerFlags("relay", box, { ...names, container: relay }),
          box.image,
          ...pipe,
        ]),
        "relay",
      );
      // The key goes to the relay alone, over stdin, into its tmpfs. Never to the box with the tree.
      const put = ["exec", "--interactive", relay, "sh", "-c", "cat > /tmp/router-key"];
      if (o.provider) must(podman(box, put, routerKey(o.provider)), "give the relay its key");
    }
    const flags = containerFlags(profile, box, names);
    must(podman(box, ["run", "--detach", ...flags, box.image, "sleep", "7200"]), "run");
    const exec: Box["exec"] = (command, input) =>
      podman(box, ["exec", "--interactive", names.container, ...command], input);
    const archive = execFileSync("git", ["archive", "--format=tar", o.treeish], {
      cwd: o.tree,
      maxBuffer: BIG,
    });
    must(exec(["tar", "-x", "-C", WORK], archive), "copy the tree in");
    // A baseline commit inside the box, so that what changed can be read back as a patch.
    must(exec(["sh", "/opt/sdlc/baseline.sh"]), "baseline");
    must(exec(["sh", "/opt/sdlc/install.sh"]), "offline install");
    return {
      exec,
      patch: () => must(exec(["sh", "/opt/sdlc/patch.sh"]), "read the patch out"),
      close,
    };
  } catch (error) {
    close();
    throw error;
  }
}

/** Whether the container engine answers. On Windows its machine needs starting after a reboot. */
export const sandboxReady = (box: SandboxConfig): boolean => podman(box, ["info"]).ok;

/**
 * Removes every container and network that carries the loop's own label, and nothing else,
 * whatever it is called. Called at the start of a pass, under the lock, so nothing it removes
 * can be in use: what it finds was left by a pass that died.
 */
export function sweep(box: SandboxConfig): string[] {
  const owned = ["--filter", `label=${OWNED}`];
  const named = (args: string[]): string[] =>
    podman(box, [...args, ...owned])
      .out.split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
  const containers = named(["ps", "--all", "--format", "{{.Names}}"]);
  if (containers.length > 0) podman(box, ["rm", "--force", "--volumes", ...containers]);
  const networks = named(["network", "ls", "--format", "{{.Name}}"]);
  if (networks.length > 0) podman(box, ["network", "rm", "--force", ...networks]);
  return [...containers, ...networks];
}
