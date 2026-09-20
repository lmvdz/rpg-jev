import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

/** Operability script: UI input drives play; diagnostics only assert committed results. */
export async function exerciseFood({ cdp, url, output, evaluate, until, click }) {
  await cdp.call("Runtime.enable");
  await cdp.call("Page.enable");
  await cdp.call("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const view = () => evaluate(cdp, "window.__food");
  const ready = () =>
    until(() =>
      evaluate(
        cdp,
        "Boolean(window.__food && !window.__smokeReloading && window.__stats?.fps > 0 && window.__chunks?.waiting === 0)",
      ),
    );
  const reload = async () => {
    await evaluate(cdp, "window.__smokeReloading = true");
    await cdp.call("Page.reload");
    await ready();
  };
  const screenshot = async (name) => {
    const image = await cdp.call("Page.captureScreenshot", { format: "png" });
    await writeFile(path.join(output, `${name}.png`), Buffer.from(image.data, "base64"));
  };
  const button = async (label, selector = ".food-panel") => {
    const point = await until(() =>
      evaluate(
        cdp,
        `(() => {
      const b = [...document.querySelectorAll(${JSON.stringify(`${selector} button`)})]
        .find(b => b.textContent === ${JSON.stringify(label)});
      if (!b) return null;
      b.scrollIntoView({block:"nearest"});
      const r = b.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};
    })()`,
      ),
    );
    await click(cdp, point, "left");
  };
  const key = async (code) => {
    const before = await view();
    for (const type of ["keyDown", "keyUp"])
      await cdp.call("Input.dispatchKeyEvent", { type, key: code, code });
    await until(async () => (await view()).tick === before.tick + 1);
    // Wait for display interpolation, not simulation. This introduces no commands.
    await evaluate(cdp, "new Promise(r => setTimeout(r, 250))");
  };
  await cdp.call("Page.navigate", { url });
  await ready();
  const initial = await view();
  assert.equal(initial.tick, 0);
  assert.equal(initial.portions.length, 5);
  assert.match(await evaluate(cdp, 'document.querySelector(".food-panel").textContent'), /camp/i);
  await screenshot("food-initial");
  await button("Save session");
  const initialSnapshot = await evaluate(cdp, 'localStorage.getItem("rpg-jev.food-session.v1")');

  await key("ArrowRight");
  // Pick the first visible portion in the fixed smoke viewport.
  await click(cdp, { x: 770, y: 470 }, "right");
  await button("take a berry portion", ".menu");
  assert.equal((await view()).held.length, 1);
  await key("ArrowRight");
  await key("ArrowRight");
  await button("Take a berry portion");
  assert.equal((await view()).held.length, 2);
  await button("Drop carried portion");
  const placed = await view();
  assert.equal(placed.held.length, 1);
  assert.notDeepEqual(
    placed.things.find((t) => t.kind === "creature"),
    initial.things.find((t) => t.kind === "creature"),
  );
  await screenshot("food-intervention");
  await key("ArrowLeft");
  await key("ArrowLeft");
  await key("ArrowLeft");
  await button("Drop carried portion");
  const returned = await view();
  assert.equal(returned.held.length, 0);
  assert.equal(returned.atCamp, 1);
  assert(returned.portions.length < initial.portions.length);
  // Retrieve the other surviving finite portion using its visible position.
  const remaining = returned.portions.find((p) => p.x > 6);
  assert(remaining);
  const walkTo = async (x, z) => {
    while ((await view()).where[0] !== x)
      await key((await view()).where[0] < x ? "ArrowRight" : "ArrowLeft");
    while ((await view()).where[1] !== z)
      await key((await view()).where[1] < z ? "ArrowDown" : "ArrowUp");
  };
  await walkTo(remaining.x, remaining.z);
  await button("Take a berry portion");
  await walkTo(6, 8);
  await button("Drop carried portion");
  const supplied = await view();
  assert.equal(supplied.atCamp, 2);

  // Open the actual pointer context menu and wait through its ordinary action.
  await click(cdp, { x: 700, y: 500 }, "right");
  await button("wait one turn", ".menu");
  await button("Save session");
  const saved = await view();
  await reload();
  assert.deepEqual(await view(), saved);
  await screenshot("food-restored");

  // Contrasting saved initial condition, prepared by code rather than a gameplay cheat.
  // Same renderer/production rules: a satiated creature must not follow food.
  await evaluate(
    cdp,
    `(() => {
    const k = "rpg-jev.food-session.v1", s = JSON.parse(${JSON.stringify(initialSnapshot)});
    s.world.bodies.forager.needs.hunger = 0;
    localStorage.setItem(k, JSON.stringify(s));
  })()`,
  );
  await reload();
  const fedBefore = await view();
  for (let i = 0; i < 3; i++) await button("Wait one turn");
  const fedAfter = await view();
  assert.deepEqual(
    fedAfter.things.filter((t) => t.kind === "creature"),
    fedBefore.things.filter((t) => t.kind === "creature"),
  );
  assert.deepEqual(fedAfter.portions, fedBefore.portions);
  await checkKeyboard({ cdp, evaluate, view });
  const glError = await evaluate(
    cdp,
    'document.querySelector("#view").getContext("webgl2").getError()',
  );
  assert.equal(glError, 0);
  return {
    launcher: "pnpm client",
    initial,
    placed,
    returned,
    supplied,
    saved,
    fedBefore,
    fedAfter,
    glError,
    workflow: "keyboard movement and visible buttons → pointer wait → save → page reload",
    humanPlaytest: false,
  };
}

async function checkKeyboard({ cdp, evaluate, view }) {
  const press = async (key, code, number) => {
    for (const type of ["keyDown", "keyUp"])
      await cdp.call("Input.dispatchKeyEvent", {
        type,
        key,
        code,
        windowsVirtualKeyCode: number,
        nativeVirtualKeyCode: number,
      });
  };
  await press("Tab", "Tab", 9);
  assert.equal(await evaluate(cdp, "document.activeElement.tagName"), "BUTTON");
  await evaluate(
    cdp,
    `(() => {
    window.__staleButton = [...document.querySelectorAll(".food-panel button")]
      .find(b => b.textContent === "Wait one turn");
    window.__staleButton.focus();
  })()`,
  );
  const before = await view();
  await press(" ", "Space", 32);
  assert.equal((await view()).tick, before.tick + 1);
  assert.equal(await evaluate(cdp, "document.activeElement.textContent"), "Wait one turn");
  await evaluate(cdp, "window.__staleButton.click()");
  assert.equal((await view()).tick, before.tick + 1, "detached stale button grants no new turn");
}
