import { describe, expect, it } from "vitest";
import {
  type Asked,
  acceptOffer,
  believeClaim,
  buildRequest,
  CachingJudge,
  compileSlice,
  FAMILIES,
  type Judge,
  Meter,
  OfflineJudge,
  overBudget,
  parseIntent,
  pickAction,
  pickDistortion,
  pickSpeechAct,
  questGuard,
  RecordedJudge,
  Recorder,
  RecordingMiss,
  ResilientJudge,
  ScriptedJudge,
  type SliceSchema,
  stakeInClaim,
  type Variant,
} from "../src/index.ts";

const opt = (id: string) => ({ id, description: `does ${id}` });
const guardWording = {
  instructions: ["Is it so?", "So, is it?"] as [string, string],
  true: "yes",
  false: "no",
};

const everyFamily = (v: Variant): Record<string, Asked> => ({
  ...parseIntent(
    {
      targets: [opt("a")],
      items: [opt("b")],
      statements: [opt("c")],
      subjects: [opt("e")],
      requests: [opt("d")],
    },
    v,
  ),
  act: pickAction("npcs.x", [opt("go")], "go", v),
  say: pickSpeechAct({ npc: "npcs.x", options: [opt("greet")], fallback: "greet" }, v),
  believes: believeClaim("npcs.x", 0.3, v),
  stake: stakeInClaim("npcs.x", 0.5, v),
  retell: pickDistortion("npcs.x", [opt("exaggerate_severity")], "as held", "keep_quiet", v),
  guard: questGuard(guardWording, v),
  accepts: acceptOffer("npcs.x", 0.2, v),
});

describe("question families", () => {
  it("cover exactly the eight families of the spec", () => {
    const used = new Set(Object.values(everyFamily(0)).map((q) => q.family));
    expect([...used].sort()).toEqual([...FAMILIES].sort());
  });

  it("give every Choice a none option and every question a fallback it could return", () => {
    for (const [id, q] of Object.entries(everyFamily(0))) {
      if (q.question.type === "choice") {
        const labels = Object.keys(q.question.criteria);
        const none = id === "retell" ? "keep_quiet" : "none_of_these";
        expect(labels, id).toContain(none);
        expect(q.fallback.type).toBe("choice");
        if (q.fallback.type === "choice") expect(labels).toContain(q.fallback.choice);
      } else {
        expect(q.question.criteria.true, id).toBeTruthy();
        expect(q.question.criteria.false, id).toBeTruthy();
      }
    }
  });

  it("have a second wording for the paraphrase test, with the same answer space", () => {
    const a = everyFamily(0);
    const b = everyFamily(1);
    for (const id of Object.keys(a)) {
      expect(b[id]?.question.instructions, id).not.toEqual(a[id]?.question.instructions);
      expect(b[id]?.question.criteria, id).toEqual(a[id]?.question.criteria);
    }
  });

  it("keep player text out of instructions and criteria", () => {
    const text = JSON.stringify(everyFamily(0));
    expect(text).toContain("`player_input.text`");
    expect(text).not.toContain("${");
  });
});

describe("slice compiler", () => {
  const schema: SliceSchema<{ lines: string[] }> = {
    id: "test",
    budgetTokens: 60,
    required: () => ["npcs.x.knows"],
    build: (ctx) => ({ npcs: { x: { knows: ctx.lines } } }),
  };

  it("hashes equal states equally and flags a slice that outgrows its budget", () => {
    const small = compileSlice(schema, { lines: ["one"] });
    expect(compileSlice(schema, { lines: ["one"] }).hash).toBe(small.hash);
    expect(overBudget(small)).toBe(false);
    expect(
      overBudget(compileSlice(schema, { lines: Array(40).fill("a long line of knowledge") })),
    ).toBe(true);
  });

  it("refuses a state that lacks a required path", () => {
    const broken = { ...schema, required: () => ["npcs.y.knows"] };
    expect(() => compileSlice(broken, { lines: [] })).toThrow("missing npcs.y.knows");
  });
});

describe("judges", () => {
  const request = buildRequest({ a: 1 }, "h", {
    guard: questGuard(guardWording),
    act: pickAction("n", [opt("go")], "go"),
  });

  it("derives the request id from state and questions", () => {
    expect(buildRequest({ a: 1 }, "h", request.questions).id).toBe(request.id);
    expect(buildRequest({ a: 1 }, "h2", request.questions).id).not.toBe(request.id);
  });

  it("falls back to code's answers when the judge is down, then stops trying for a while", async () => {
    let attempts = 0;
    const failing: Judge = {
      ask: () => {
        attempts += 1;
        return new OfflineJudge().ask();
      },
    };
    const judge = new ResilientJudge(failing, 3);
    const first = await judge.ask(request);
    expect(first.source).toBe("fallback");
    expect(first.answers.act).toMatchObject({ choice: "go" });
    expect(first.answers.guard).toEqual({ type: "noul", noul: 0 });
    await judge.ask(request);
    await judge.ask(request);
    await judge.ask(request);
    expect(attempts).toBe(1);
    await judge.ask(request);
    expect(attempts).toBe(2);
  });

  it("replays recorded answers by request id and fails loudly on a miss", async () => {
    const live = new ScriptedJudge((id) =>
      id === "guard" ? { type: "noul", noul: 0.9 } : undefined,
    );
    const recorder = new Recorder(live);
    await recorder.ask(request);

    const replayed = new RecordedJudge(structuredClone(recorder.recordings));
    expect((await replayed.ask(request)).answers.guard).toEqual({ type: "noul", noul: 0.9 });
    await expect(replayed.ask(buildRequest({ a: 2 }, "other", request.questions))).rejects.toThrow(
      RecordingMiss,
    );
  });

  it("meters calls per action and serves repeats from cache", async () => {
    const meter = new Meter(new ScriptedJudge(() => undefined));
    const judge = new CachingJudge(meter);
    meter.begin("look");
    await judge.ask(request);
    await judge.ask(request);
    expect(meter.current.calls).toBe(1);
    expect(meter.current.questions).toBe(2);
  });
});
