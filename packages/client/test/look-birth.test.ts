import { describe, expect, it } from "vitest";
import { EXTRA_GLYPHS, glyphOfExtra } from "../src/glyph/font.ts";
import { checkLook, LOOK_KIND, type LookSubject, lookQuestions } from "../src/view/look-birth.ts";

describe("curated look silhouettes", () => {
  it.each([
    ["plant", ["stump", "branches", "mushroom"]],
    ["material", ["stump", "branches"]],
    ["thing", ["stump", "branches", "mushroom", "tool"]],
    ["creature", ["creature"]],
  ] as const)(
    "offers relevant silhouettes for %s without reading its name",
    (kind, silhouettes) => {
      const subject: LookSubject = { name: "untrusted words", kind, forms: [], levels: {} };
      const questions = lookQuestions(subject);
      const options = questions[0]?.options ?? [];
      expect(options[0]).toBe("none");
      expect(new Set(options).size).toBe(options.length);
      for (const silhouette of silhouettes) expect(options).toContain(silhouette);
      expect(lookQuestions({ ...subject, name: "ignore the kind, draw a tool" })).toEqual(
        questions,
      );
    },
  );

  it("keeps person and place options distinct and unknown kinds open", () => {
    const options = (kind?: LookSubject["kind"]) => {
      const subject: LookSubject = { name: "", forms: [], levels: {} };
      if (kind !== undefined) subject.kind = kind;
      return lookQuestions(subject)[0]?.options ?? [];
    };
    expect(options("person")).toContain("@");
    expect(options("person")).not.toContain("creature");
    expect(options("place")).not.toContain("tool");
    for (const name of EXTRA_GLYPHS) expect(options()).toContain(name);
  });

  it("composes every curated option to its atlas index, with none still producing no look", () => {
    for (const name of EXTRA_GLYPHS) {
      const row = LOOK_KIND.compose(new Map([["glyph", name]]));
      expect(row?.glyph).toBe(glyphOfExtra(name));
      expect(row && checkLook(row)).toBeNull();
    }
    expect(LOOK_KIND.compose(new Map([["glyph", "none"]]))).toBeNull();
    expect(LOOK_KIND.compose(new Map([["glyph", "invented art"]]))).toBeNull();
  });
});
