/**
 * The sandbox's rules that can be checked without a container: when tool stages may run, and
 * that no container is ever created with a way to reach the host's files or the internet.
 */
import { describe, expect, it } from "vitest";
import {
  ACCEPTANCE,
  agentModels,
  containerFlags,
  type Profile,
  type SandboxConfig,
  toolStagesAllowed,
} from "../src/sdlc/sandbox.ts";

const box: SandboxConfig = {
  kind: "podman",
  image: "rpg-jev-sdlc:test",
  model_port: 20128,
  cpus: 4,
  memory_mb: 6144,
  pids: 512,
};
const names = { container: "sdlc-7-agent", internal: "sdlc-7-net" };
const PROFILES: Profile[] = ["agent", "gate", "relay"];

describe("when the tool stages may run", () => {
  it("needs both decisions: that they may run, and where", () => {
    expect(toolStagesAllowed({ allow_tool_stages: false, sandbox: box }).ok).toBe(false);
    expect(toolStagesAllowed({ allow_tool_stages: true }).ok).toBe(false);
    expect(toolStagesAllowed({ allow_tool_stages: true, sandbox: box }).ok).toBe(true);
  });

  it("runs unsandboxed only on a person's exact sentence", () => {
    const none = { ...box, kind: "none" as const };
    expect(toolStagesAllowed({ allow_tool_stages: true, sandbox: none }).ok).toBe(false);
    const nearly = { ...none, accept: "yes" };
    expect(toolStagesAllowed({ allow_tool_stages: true, sandbox: nearly }).ok).toBe(false);
    const said = { ...none, accept: ACCEPTANCE };
    expect(toolStagesAllowed({ allow_tool_stages: true, sandbox: said }).ok).toBe(true);
    expect(toolStagesAllowed({ allow_tool_stages: false, sandbox: said }).ok).toBe(false);
  });
});

describe("every container", () => {
  for (const profile of PROFILES)
    it(`${profile}: drops every capability, cannot gain privilege, and is bounded`, () => {
      const flags = containerFlags(profile, box, names);
      expect(flags).toContain("--cap-drop=all");
      expect(flags).toContain("--security-opt=no-new-privileges");
      expect(flags).toContain("--read-only");
      expect(flags).toContain("--pids-limit=512");
      expect(flags).toContain("--memory=6144m");
      expect(flags).toContain("--cpus=4");
      expect(flags[flags.indexOf("--user") + 1]).toBe("1000:1000");
    });

  for (const profile of PROFILES)
    it(`${profile}: is given no host path, device, socket or extra privilege`, () => {
      const flags = containerFlags(profile, box, names);
      const volumes = flags.filter((_, i) => flags[i - 1] === "--volume");
      // An anonymous volume has no source. A colon would mean a host path or a named volume.
      for (const v of volumes) expect(v).not.toContain(":");
      const joined = flags.join(" ");
      // Whole flags, so that --pids-limit is not mistaken for --pid.
      const banned = ["--privileged", "--device", "--mount", "--pid", "--ipc", "--volumes-from"];
      for (const flag of flags)
        for (const b of banned) expect(flag === b || flag.startsWith(`${b}=`), flag).toBe(false);
      expect(joined).not.toContain("podman.sock");
      expect(joined).not.toMatch(/--network[ =]host/);
    });
});

describe("what each container can reach", () => {
  const network = (profile: Profile) => {
    const flags = containerFlags(profile, box, names);
    return flags[flags.indexOf("--network") + 1];
  };

  it("the gate reaches nothing", () => {
    expect(network("gate")).toBe("none");
  });

  it("the agent reaches only the closed network the relay is on", () => {
    expect(network("agent")).toBe(names.internal);
  });

  it("only the relay has a leg outside, and it is not where the tree is", () => {
    expect(network("relay")).toBe(`${names.internal},podman`);
    expect(containerFlags("relay", box, names)).not.toContain("/work");
  });

  it("the agent is told of one provider, one model, and the relay as its address", () => {
    const models = JSON.parse(agentModels(box, "omniroute", "auto/coding:cheap", "k")) as {
      providers: Record<string, { baseUrl: string; models: { id: string }[] }>;
    };
    expect(Object.keys(models.providers)).toEqual(["omniroute"]);
    expect(models.providers.omniroute?.baseUrl).toBe("http://relay:20128/v1");
    expect(models.providers.omniroute?.models.map((m) => m.id)).toEqual(["auto/coding:cheap"]);
  });
});
