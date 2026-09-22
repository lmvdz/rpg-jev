/** Real two-browser workflow against an already-running local world and archive worker. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const [browserPath, outputPath, mode] = process.argv.slice(2);
assert(browserPath && outputPath, "Usage: browser.mjs <chrome executable> <new scratch directory>");
assert(!mode || mode === "--reuse-protocol-identities", "Unknown browser verification mode");
const output = path.resolve(outputPath);
await mkdir(output);
const root = path.resolve(import.meta.dirname, "../..");
const errors = [];
const browsers = [];
const connections = [];
const tokens = [];
function redact(text) {
  let safe = text;
  for (const token of tokens) safe = safe.replaceAll(token, "[credential]");
  return safe.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[credential]");
}
const vite = spawn(
  process.execPath,
  [
    path.join(root, "packages/client/node_modules/vite/bin/vite.js"),
    "--host",
    "127.0.0.1",
    "--port",
    "5178",
    "--strictPort",
  ],
  { cwd: path.join(root, "packages/client"), stdio: "inherit", windowsHide: true },
);

async function until(read, label, timeout = 30_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const result = await read();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out: ${label}`);
}

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", ({ data }) => {
    const event = JSON.parse(String(data));
    if (event.method === "Runtime.exceptionThrown") errors.push(event.params.exceptionDetails);
    if (event.method === "Runtime.consoleAPICalled" && event.params.type === "error")
      errors.push(event.params);
    const request = pending.get(event.id);
    if (!request) return;
    pending.delete(event.id);
    clearTimeout(request.timer);
    if (event.error) request.reject(new Error(JSON.stringify(event.error)));
    else request.resolve(event.result);
  });
  return {
    close: () => socket.close(),
    call(method, params = {}) {
      return new Promise((resolve, reject) => {
        const number = ++id;
        const timer = setTimeout(() => reject(new Error(`CDP timed out: ${method}`)), 10_000);
        pending.set(number, { resolve, reject, timer });
        socket.send(JSON.stringify({ id: number, method, params }));
      });
    },
  };
}

async function evaluate(cdp, expression) {
  const value = await cdp.call("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (value.exceptionDetails) throw new Error(JSON.stringify(value.exceptionDetails));
  return value.result.value;
}

async function browser(label) {
  const profile = await mkdtemp(path.join(output, "chrome-"));
  const process = spawn(
    browserPath,
    [
      "--headless=new",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-extensions",
      "--enable-unsafe-swiftshader",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true },
  );
  browsers.push(process);
  const port = await until(async () => {
    try {
      return (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0];
    } catch {
      return null;
    }
  }, "Chrome debugging port");
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const cdp = await connect(tabs.find((tab) => tab.type === "page").webSocketDebuggerUrl);
  connections.push(cdp);
  await cdp.call("Runtime.enable");
  await cdp.call("Page.enable");
  if (mode) {
    const token = await readFile(
      path.join(root, `packages/server/.stdb/protocol-${label}.token`),
      "utf8",
    );
    tokens.push(token);
    await cdp.call("Page.addScriptToEvaluateOnNewDocument", {
      source: `if (location.origin === "http://127.0.0.1:5178") sessionStorage.setItem("rpg-jev.shared.v1:ws://127.0.0.1:3057:rpg-open-world:token", ${JSON.stringify(token)});`,
    });
  }
  await cdp.call("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.call("Page.navigate", { url: "http://127.0.0.1:5178/?shared" });
  await until(() => evaluate(cdp, "window.__sharedView?.actor"), "host admission");
  return cdp;
}

async function key(cdp, key, code, keyCode) {
  for (const type of ["keyDown", "keyUp"])
    await cdp.call("Input.dispatchKeyEvent", { type, key, code, windowsVirtualKeyCode: keyCode });
}

async function click(cdp, point, button = "left") {
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
  for (const type of ["mousePressed", "mouseReleased"])
    await cdp.call("Input.dispatchMouseEvent", { type, ...point, button, clickCount: 1 });
}

function findButton(cdp, word) {
  return evaluate(
    cdp,
    `(() => {
    const button = [...document.querySelectorAll(".menu button, .act-panel button")]
      .find(b => b.textContent.toLowerCase().includes(${JSON.stringify(word)}));
    if (!button) return null; const r=button.getBoundingClientRect();
    return {x:r.x+r.width/2,y:r.y+r.height/2,text:button.textContent};
  })()`,
  );
}

const view = (cdp) => evaluate(cdp, "window.__sharedView");
try {
  await until(async () => {
    try {
      return (await fetch("http://127.0.0.1:5178/")).ok;
    } catch {
      return false;
    }
  }, "Vite");
  const a = await browser("A");
  const b = await browser("B");
  const initialA = await view(a);
  const initialB = await view(b);
  assert.notEqual(initialA.actor, initialB.actor);
  await until(
    async () => (await view(a)).things.some((thing) => thing.id === initialB.actor),
    "other traveller",
  );
  const latency = [];
  let moved = false;
  for (const [name, code, number] of [
    ["d", "KeyD", 68],
    ["w", "KeyW", 87],
    ["a", "KeyA", 65],
    ["s", "KeyS", 83],
  ]) {
    const before = await view(a);
    const start = performance.now();
    await key(a, name, code, number);
    const after = await until(
      async () => {
        const next = await view(a);
        return next.sequence > before.sequence ? next : null;
      },
      `keyboard ${name} acknowledgement`,
      3000,
    ).catch(() => null);
    if (!after || JSON.stringify(after.position) === JSON.stringify(before.position)) continue;
    latency.push(performance.now() - start);
    await until(async () => {
      const other = (await view(b)).things.find((thing) => thing.id === initialA.actor);
      return other && other.x === after.position[0] && other.z === after.position[1];
    }, "second browser sees committed movement");
    moved = true;
    break;
  }
  assert(moved, "no actual keyboard movement committed");
  const currentA = await view(a);
  await cdpScreenshot(a, "player-a.png");
  await cdpScreenshot(b, "player-b.png");
  await cdpMenu(a);
  const beforeReload = await view(a);
  await a.call("Page.reload");
  await until(() => evaluate(a, "window.__sharedView?.actor"), "reload");
  const reloaded = await view(a);
  assert.equal(reloaded.actor, beforeReload.actor);
  assert.deepEqual(reloaded.position, beforeReload.position);
  const at = (await view(b)).tick;
  await key(a, "Tab", "Tab", 9);
  await until(async () => (await view(b)).tick >= at + 2, "host time independent of client UI");
  assert.equal(
    await evaluate(
      a,
      'document.querySelector(".editor") ? getComputedStyle(document.querySelector(".editor")).display : "none"',
    ),
    "none",
  );
  for (const cdp of [a, b]) {
    assert.equal(
      await evaluate(cdp, 'document.querySelector("#view").getContext("webgl2").getError()'),
      0,
    );
    assert.equal(await evaluate(cdp, "Boolean(window.__world || window.__walker)"), false);
  }
  assert.deepEqual(errors, []);
  const result = {
    environment: {
      node: process.version,
      platform: process.platform,
      browser: "Chrome headless/WebGL2",
    },
    actors: [initialA.actor, initialB.actor],
    movement: { from: initialA.position, to: currentA.position },
    commandAckMs: latency,
    independentClock: true,
    genericMenuAction: true,
    reloadIdentityAndPosition: true,
    browserErrors: errors,
    humanPlaytest: false,
  };
  await writeFile(path.join(output, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  const clients = [];
  for (const cdp of connections) {
    try {
      clients.push(
        await evaluate(
          cdp,
          `({
        actor: window.__sharedView?.actor, position: window.__sharedView?.position,
        revision: window.__sharedView?.revision, sequence: window.__sharedView?.sequence,
        hud: document.querySelector("#hud")?.textContent
      })`,
        ),
      );
    } catch {
      /* A disconnected debugging target cannot provide evidence. */
    }
  }
  await writeFile(
    path.join(output, "failure.json"),
    redact(JSON.stringify({ message: String(error), errors, clients }, null, 2)),
  );
  throw new Error(redact(String(error)));
} finally {
  for (const cdp of connections) {
    try {
      await cdp.call("Browser.close");
    } catch {
      /* Browser may already have exited. */
    }
    cdp.close();
  }
  for (const process of browsers) process.kill();
  vite.kill();
}

async function cdpScreenshot(cdp, name) {
  const result = await cdp.call("Page.captureScreenshot", { format: "png" });
  await writeFile(path.join(output, name), Buffer.from(result.data, "base64"));
}

async function cdpMenu(cdp) {
  await click(cdp, { x: 640, y: 400 }, "right");
  const menu = await until(
    () => evaluate(cdp, 'document.querySelector(".menu")?.textContent'),
    "generic menu",
  );
  assert(!menu.includes("wait a while"), "client must not advance global time");
  const search = await findButton(cdp, "look around for stone");
  assert(search, `generic search missing from world menu: ${menu}`);
  const before = await view(cdp);
  await click(cdp, search);
  await until(
    async () => (await view(cdp)).sequence > before.sequence,
    "generic action acknowledgement",
  );
  const hud = await evaluate(cdp, 'document.querySelector("#hud").textContent');
  assert(!/rejected|Not done/.test(hud), `generic action failed: ${hud}`);
  const controls = await evaluate(cdp, "document.body.innerText");
  await writeFile(path.join(output, "generic-action-ui.txt"), `${controls.trimEnd()}\n`);
}
