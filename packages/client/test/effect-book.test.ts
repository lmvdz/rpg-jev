import { describe, expect, it } from "vitest";
import { GlyphBatch } from "../src/glyph/batch.ts";
import { TileGrid } from "../src/terrain/grid.ts";
import { effectQuestions, HAPPENINGS } from "../src/view/effect-birth.ts";
import {
  type AskJudge,
  askPriors,
  EffectBook,
  showingOf,
  subjectOf,
} from "../src/view/effect-book.ts";
import { EFFECTS, GENERIC } from "../src/view/effect-rows.ts";
import { checkEffect, EMITTER_FLOATS, EmitterList } from "../src/view/effects.ts";
import { LivingThings } from "../src/view/living.ts";
import type { ThingView } from "../src/view/things.ts";
import { ObjectLayer } from "../src/world/objects.ts";

const pitch = { element: "e7", name: "pitch", forms: ["liquid"], baseline: { mass: 2 } };

/** A judge whose mind is made up: all the odds on one option of each question it cares about. */
function insists(wants: Record<string, string>): AskJudge {
  return (_subject, questions) =>
    Promise.resolve(
      questions.map((asked) =>
        asked.options.map((option, i) => {
          const want = wants[asked.field];
          if (want === undefined) return asked.prior[i] ?? 0;
          return option === want ? 1 : 0;
        }),
      ),
    );
}

describe("what is happening to a thing", () => {
  it("follows its visible states and nothing else", () => {
    expect(showingOf({})).toEqual([]);
    expect(showingOf({ growth: 3, amount: 2 })).toEqual([]);
    expect(showingOf({ burning: 3 })).toEqual([
      { happening: "burns", level: 3 },
      { happening: "fumes", level: 3 },
    ]);
    expect(showingOf({ temperature: 5 })).toEqual([{ happening: "fumes", level: 1 }]);
    expect(showingOf({ burning: 99 })[0]?.level).toBe(5);
  });

  it("makes a subject of the element as it is whole, in the vocabulary's words only", () => {
    const subject = subjectOf({ ...pitch, forms: ["liquid", "haunted"] }, "burns");
    expect(subject).toEqual({
      name: "pitch",
      happening: "burns",
      forms: ["liquid"],
      levels: { mass: 2 },
    });
  });
});

describe("the book of born effects", () => {
  it("plays the happening's generic row until the judge answers, then the born row", async () => {
    const book = new EffectBook(insists({ motion: "orbit", ramp: "strange" }), 1);
    const entry = book.entry(pitch, "burns");
    expect(entry.born).toBe(false);
    expect(entry.rows[5]?.[0]).toMatchObject({ motion: GENERIC.burns?.motion });
    await book.settled();
    expect(entry.born).toBe(true);
    const row = entry.rows[5]?.[0];
    expect(row?.motion).toBe("orbit");
    expect(row && checkEffect(row)).toBeNull();
  });

  it("decides once for an element and a happening, however many ask", async () => {
    let asked = 0;
    const counting: AskJudge = (subject, questions) => {
      asked++;
      return askPriors(subject, questions);
    };
    const book = new EffectBook(counting, 1);
    const first = book.entry(pitch, "burns");
    expect(book.entry({ ...pitch, name: "renamed" }, "burns")).toBe(first);
    book.entry(pitch, "fumes");
    await book.settled();
    book.entry(pitch, "burns");
    expect(asked).toBe(2);
    expect(book.log.map((line) => [line.element, line.happening, line.fallback])).toEqual([
      ["e7", "burns", false],
      ["e7", "fumes", false],
    ]);
  });

  it("plays it thinner the less it is happening, and not at all at nothing", async () => {
    const book = new EffectBook(askPriors, 1);
    const entry = book.entry(pitch, "burns");
    await book.settled();
    expect(entry.rows).toHaveLength(6);
    expect(entry.rows[0]).toEqual([]);
    const rates = entry.rows.slice(1).map((rows) => rows[0]?.rate ?? 0);
    expect(rates).toEqual([...rates].sort((a, b) => a - b));
    expect(rates[0]).toBeGreaterThanOrEqual(1);
    expect(rates[4]).toBeGreaterThan(rates[0] ?? 9);
  });

  it("replays a log without asking, and draws the same again from the same seed", async () => {
    const sampling: AskJudge = (_subject, questions) =>
      Promise.resolve(questions.map((q) => q.prior));
    const book = new EffectBook(sampling, 7);
    const entry = book.entry(pitch, "struck");
    await book.settled();

    const again = new EffectBook(sampling, 7);
    const twin = again.entry(pitch, "struck");
    await again.settled();
    expect(twin.rows).toEqual(entry.rows);

    const never: AskJudge = () => Promise.reject(new Error("asked"));
    const restored = new EffectBook(never, 99);
    restored.restore(book.log);
    const replayed = restored.entry(pitch, "struck");
    expect(replayed.born).toBe(true);
    expect(replayed.rows).toEqual(entry.rows);
    expect(restored.log).toEqual(book.log);
  });

  it("falls back to the priors when the judge fails, and says so in the log", async () => {
    const book = new EffectBook(() => Promise.reject(new Error("down")), 1);
    const entry = book.entry(pitch, "burns");
    await book.settled();
    expect(entry.born).toBe(true);
    expect(entry.rows[3]?.[0]?.motion).toBe("rise");
    expect(book.log[0]?.fallback).toBe(true);
  });

  it("gives a valid row or nothing for every happening, from the priors alone", async () => {
    const book = new EffectBook(askPriors, 1);
    const entries = HAPPENINGS.map((happening) => book.entry(pitch, happening));
    await book.settled();
    for (const entry of entries) {
      for (const row of entry.rows.flat()) expect(checkEffect(row)).toBeNull();
    }
    expect(book.log).toHaveLength(HAPPENINGS.length);
    expect(effectQuestions(subjectOf(pitch, "exists"))[0]?.options[0]).toBe("none");
  });
});

describe("the things on screen", () => {
  const grid = new TileGrid(8, 8);
  const thing = (x: number, burning: number): ThingView => ({
    ...pitch,
    x,
    z: 2,
    look: { glyph: 1, ink: 1 },
    states: { burning },
  });

  it("emit what the book holds for them, the born row once it is there", async () => {
    const things = [thing(1, 4), thing(2, 0), thing(3, 2)];
    const book = new EffectBook(insists({ motion: "cling" }), 1);
    const living = new LivingThings(things, grid, new ObjectLayer(grid, new GlyphBatch(8)), book);
    const emitters = new EmitterList();
    const motions = () => {
      emitters.begin();
      living.emit(emitters);
      return Array.from(
        { length: emitters.count },
        (_, i) => emitters.data[i * EMITTER_FLOATS + 4],
      );
    };
    // Two burning things, each flaming and fuming, with the generic rows: both rise.
    expect(motions()).toEqual([0, 0, 0, 0]);
    await book.settled();
    expect(motions()).toEqual([5, 5, 5, 5]);
    expect(book.log).toHaveLength(2);

    (things[0] as ThingView).states.burning = 0;
    living.redraw([0]);
    expect(motions()).toHaveLength(2);
    expect(EFFECTS.flames.motion).toBe("rise");
  });
});
