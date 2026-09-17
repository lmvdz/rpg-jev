import { describe, expect, it } from "vitest";
import { allProbes } from "../src/probes.ts";

/** Rough token count; the 32k state cap in SPEC.md section 11 is the hard limit. */
const roughTokens = (value: unknown) => JSON.stringify(value).length / 4;

describe("M0 probes", () => {
  it("have unique ids", () => {
    const ids = allProbes.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("repeat at least once", () => {
    for (const probe of allProbes) expect(probe.repeats, probe.id).toBeGreaterThan(0);
  });

  it("point at questions that exist", () => {
    for (const probe of allProbes) {
      const meta = probe.meta;
      if ("question" in meta) expect(probe.questions, probe.id).toHaveProperty(meta.question);
      if (meta.test === "isolation" && meta.control) {
        expect(probe.questions, probe.id).toHaveProperty(meta.control);
      }
      if (meta.test === "intent") {
        expect(probe.questions, probe.id).toHaveProperty("verb");
        expect(probe.questions, probe.id).toHaveProperty("target");
      }
    }
  });

  it("give every Choice an escape option (rule 4)", () => {
    const escapes = ["none_of_these", "no_idea"];
    for (const probe of allProbes) {
      for (const [id, question] of Object.entries(probe.questions)) {
        if (question.type !== "choice") continue;
        const labels = Object.keys(question.criteria);
        expect(
          labels.some((l) => escapes.includes(l)),
          `${probe.id}/${id}`,
        ).toBe(true);
      }
    }
  });

  it("watch an option that the question actually offers", () => {
    for (const probe of allProbes) {
      const meta = probe.meta;
      const labelsOf = (questionId: string) => {
        const q = probe.questions[questionId];
        if (!q) return [];
        return q.type === "choice" ? Object.keys(q.criteria) : ["yes", "no"];
      };
      if (meta.test === "sensitivity" && meta.role === "directional") {
        expect(labelsOf(meta.question), probe.id).toContain(meta.target);
      }
      if (meta.test === "isolation") {
        expect(labelsOf(meta.question), probe.id).toContain(meta.leakOption);
        if (meta.control) expect(labelsOf(meta.control), probe.id).toContain(meta.controlOption);
      }
      if (meta.test === "intent") {
        expect(labelsOf("verb"), probe.id).toContain(meta.expected.verb);
        expect(labelsOf("target"), probe.id).toContain(meta.expected.target);
      }
    }
  });

  it("keep isolation secrets out of the clean and solo variants", () => {
    const secrets = [
      "slid the ledger",
      "stable loft",
      "counterfeit",
      "wanted notice",
      "lose his whole",
      "invented the jetty",
    ];
    for (const probe of allProbes) {
      if (probe.meta.test !== "isolation") continue;
      const text = JSON.stringify(probe.state);
      const present = secrets.some((s) => text.includes(s));
      expect(present, probe.id).toBe(probe.meta.variant === "leak");
    }
  });

  it("stay far below the state token cap", () => {
    for (const probe of allProbes) {
      expect(roughTokens(probe.state) + roughTokens(probe.questions), probe.id).toBeLessThan(2000);
    }
  });
});
