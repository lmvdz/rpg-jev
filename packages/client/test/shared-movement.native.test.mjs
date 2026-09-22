// Dependency-free: node --test packages/client/test/shared-movement.native.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { SharedPlay } from "../src/play/shared-play.ts";
import { Walker } from "../src/scene/walker.ts";
import { TileGrid } from "../src/terrain/grid.ts";

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

function setup() {
  const grid = new TileGrid(8, 8);
  const walker = new Walker(grid, 2, 2);
  const messages = [];
  const moves = [];
  const acts = [];
  const rendered = [];
  let onView;
  let onStatus;
  let resolve;
  let reject;
  const play = new SharedPlay(
    walker,
    { replace: (things) => rendered.push(things) },
    (view, status) => {
      onView = view;
      onStatus = status;
      return {
        move: (to) => {
          moves.push(to);
          return new Promise((yes, no) => {
            resolve = yes;
            reject = no;
          });
        },
        act: (answers, operands) => {
          acts.push({ answers, operands });
          return Promise.resolve();
        },
        close: () => {
          // No socket in this input fixture.
        },
      };
    },
    (message) => messages.push(message),
  );
  const project = (position = [2, 2], things = [], revision = 1) =>
    onView({
      actor: "self",
      revision,
      tick: revision,
      sequence: moves.length,
      seed: 1,
      position,
      things,
      elements: {},
      body: { meters: [], counts: [] },
      aware: [],
      compiled: ["force", "heat", "soak", "coat", "eat", "wait", "search"],
      sought: [],
    });
  return {
    grid,
    walker,
    play,
    messages,
    moves,
    acts,
    rendered,
    project,
    status: (message) => onStatus(message),
    accept: () => resolve(),
    reject: (reason) => reject(new Error(reason)),
  };
}

test("shared movement is disabled before first projection and awaits accepted position", async () => {
  const s = setup();
  s.walker.press("d", 0);
  await flush();
  assert.equal(s.moves.length, 0);
  s.project();
  s.walker.press("d", 0);
  s.walker.press("d", 0);
  s.walker.update(1, 0);
  assert.equal(s.moves.length, 1);
  assert.deepEqual([s.walker.tileX, s.walker.x], [2, 2.5]);
  assert.equal(s.play.ready, false);
  s.project([3, 2], [], 2);
  s.accept();
  await flush();
  assert.deepEqual([s.walker.tileX, s.walker.x], [3, 2.5]);
  s.walker.update(1 / 60, 0);
  assert.ok(s.walker.x > 2.5 && s.walker.x < 3.5);
});

test("rejection is visible, clears the queued path and never moves", async () => {
  const s = setup();
  s.project();
  s.walker.follow([s.grid.index(3, 2), s.grid.index(4, 2)]);
  s.walker.update(1, 0);
  for (let i = 0; i < 10; i++) s.walker.update(1, 0);
  assert.equal(s.moves.length, 1);
  s.reject("occupied");
  await flush();
  assert.equal(s.walker.busy, false);
  assert.deepEqual([s.walker.tileX, s.walker.x], [2, 2.5]);
  assert.match(s.messages.join("\n"), /occupied/);
});

test("each queued path step waits for the matching projection and animation", async () => {
  const s = setup();
  s.project();
  s.walker.follow([s.grid.index(3, 2), s.grid.index(4, 2)]);
  s.walker.update(1, 0);
  s.project([3, 2], [], 2);
  s.accept();
  await flush();
  assert.equal(s.moves.length, 1);
  s.walker.update(1, 0);
  assert.deepEqual(s.moves, [
    [3, 2],
    [4, 2],
  ]);
  s.project([4, 2], [], 3);
  s.accept();
  await flush();
  s.walker.update(1, 0);
  assert.equal(s.walker.busy, false);
});

test("disconnect cancels queued input; reconnect replaces projection and corrects pose", async () => {
  const s = setup();
  s.project([2, 2], [{ id: "old" }]);
  s.walker.follow([s.grid.index(3, 2), s.grid.index(4, 2)]);
  s.walker.update(1, 0);
  s.status("Disconnected: socket closed");
  s.reject("Disconnected");
  await flush();
  s.walker.press("d", 0);
  await flush();
  assert.equal(s.moves.length, 1);
  assert.equal(s.play.ready, false);
  s.project([5, 5], [{ id: "self" }, { id: "other" }], 0);
  assert.deepEqual([s.walker.tileX, s.walker.tileZ, s.walker.x], [5, 5, 5.5]);
  assert.equal(s.walker.path.length, 0);
  assert.deepEqual(s.rendered.at(-1), [{ id: "other" }]);
  assert.equal(s.play.ready, true);
});

test("an unsolicited correction wins over a late movement acknowledgement", async () => {
  const s = setup();
  s.project();
  s.walker.press("d", 0);
  s.project([5, 5], [], 2);
  s.accept();
  await flush();
  assert.deepEqual([s.walker.tileX, s.walker.tileZ], [5, 5]);
  assert.equal(s.walker.busy, false);
});

test("shared actions use structured answers and operands without local resolution", async () => {
  const s = setup();
  s.project();
  const request = {
    questions: [{ field: "process", options: ["X2"] }],
    things: { T0: "stone-id" },
  };
  const answers = { process: "X2" };
  await s.play.act(request, answers);
  assert.deepEqual(s.acts, [{ answers, operands: { T0: "stone-id" } }]);
  assert.throws(() => s.play.port.act(answers, {}), /host/);
});
