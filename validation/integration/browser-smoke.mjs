import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";

const [repository, browserPath, outputDirectory] = process.argv.slice(2);
if (!(repository && browserPath && outputDirectory)) {
  throw new Error(
    "Usage: node browser-smoke.mjs <repository> <chromium executable> <output directory>",
  );
}
const root = path.resolve(repository);
const output = path.resolve(outputDirectory);

async function until(read, timeout = 60_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Smoke readiness timed out");
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert(address && typeof address !== "string");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function jsonAt(url, options) {
  try {
    const response = await fetch(url, options);
    if (response.ok) return await response.json();
  } catch {
    return null;
  }
  return null;
}

async function connect(url, errors) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const pending = new Map();
  let next = 0;
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(String(data));
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      errors.push(message.params);
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  });
  return {
    close: () => socket.close(),
    call(method, params = {}) {
      const id = ++next;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP timed out: ${method} ${JSON.stringify(params)}`));
        }, 15_000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function evaluate(cdp, expression) {
  const answer = await cdp.call("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (answer.exceptionDetails) throw new Error(JSON.stringify(answer.exceptionDetails));
  return answer.result.value;
}

async function tab(cdp) {
  for (const type of ["keyDown", "keyUp"]) {
    await cdp.call("Input.dispatchKeyEvent", {
      type,
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9,
    });
  }
}

async function click(cdp, point, button) {
  await cdp.call("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
  for (const type of ["mousePressed", "mouseReleased"]) {
    await cdp.call("Input.dispatchMouseEvent", { type, ...point, button, clickCount: 1 });
  }
}

async function exercise(cdp, url) {
  await cdp.call("Runtime.enable");
  await cdp.call("Page.enable");
  await cdp.call("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.call("Page.navigate", { url });
  await until(() =>
    evaluate(
      cdp,
      "Boolean(window.__world?.port && window.__stats?.fps > 0 && window.__chunks?.waiting === 0)",
    ),
  );
  console.log("Smoke: clearing and world port ready");
  const before = await evaluate(
    cdp,
    `({
    canvas: [document.querySelector("#view").width, document.querySelector("#view").height],
    fps: __stats.fps, draws: __world.port.draws.length,
    hunger: __world.port.world.bodies.hero.needs.hunger,
    renderer: (() => {
      const gl = document.querySelector("#view").getContext("webgl2");
      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      return debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : "WebGL2";
    })(),
    hud: document.querySelector("#hud").textContent
  })`,
  );
  assert(before.canvas.every((n) => n > 0));
  await tab(cdp);
  await until(() =>
    evaluate(cdp, 'getComputedStyle(document.querySelector(".editor")).display === "block"'),
  );
  await tab(cdp);
  await until(() =>
    evaluate(cdp, 'getComputedStyle(document.querySelector(".editor")).display === "none"'),
  );
  console.log("Smoke: editor toggled both ways");
  const center = await evaluate(
    cdp,
    `(() => {
    const r = document.querySelector("#view").getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`,
  );
  await click(cdp, center, "right");
  const waitButton = await until(() =>
    evaluate(
      cdp,
      `(() => {
    const b = [...document.querySelectorAll(".menu button")]
      .find(node => node.textContent.includes("wait a while"));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`,
    ),
  );
  await click(cdp, waitButton, "left");
  console.log("Smoke: wait selected from pointer menu");
  await until(() => evaluate(cdp, `__world.port.draws.length === ${before.draws + 1}`));
  await until(() =>
    evaluate(cdp, 'document.querySelector("#hud").textContent.includes("it burns down")'),
  );
  const after = await evaluate(
    cdp,
    `({
    draws: __world.port.draws.length, last: __world.port.draws.at(-1),
    hunger: __world.port.world.bodies.hero.needs.hunger,
    hud: document.querySelector("#hud").textContent,
    glError: document.querySelector("#view").getContext("webgl2").getError()
  })`,
  );
  assert.equal(after.last.process, "drift");
  assert(after.hunger > before.hunger);
  assert(!before.hud.includes("it burns down"));
  assert(after.hud.includes("it burns down"));
  assert.equal(after.glError, 0);
  return { before, after, editToggle: true, actionRoute: "pointer menu → world port → core → HUD" };
}

async function main() {
  await mkdir(output, { recursive: true });
  const profile = await mkdtemp(path.join(output, "chromium-profile-"));
  const port = await freePort();
  const url = `http://127.0.0.1:${port}/?seed=1`;
  const vite = path.join(root, "packages/client/node_modules/vite/bin/vite.js");
  const server = spawn(
    process.execPath,
    [vite, "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
    { cwd: path.join(root, "packages/client"), windowsHide: true, stdio: "ignore" },
  );
  const browser = spawn(
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
    { windowsHide: true, stdio: "ignore" },
  );
  const errors = [];
  server.once("error", (error) => errors.push({ process: "vite", message: error.message }));
  browser.once("error", (error) => errors.push({ process: "browser", message: error.message }));
  let cdp;
  try {
    await until(async () => {
      try {
        return (await fetch(url)).ok;
      } catch {
        return false;
      }
    });
    const debugPort = await until(async () => {
      try {
        return (await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0];
      } catch {
        return null;
      }
    });
    const target = await jsonAt(`http://127.0.0.1:${debugPort}/json/new?about:blank`, {
      method: "PUT",
    });
    assert(target?.webSocketDebuggerUrl);
    cdp = await connect(target.webSocketDebuggerUrl, errors);
    const result = await exercise(cdp, url);
    assert.deepEqual(errors, []);
    const report = { browser: browserPath, ...result, errors };
    await writeFile(path.join(output, "result.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    if (cdp) {
      await cdp.call("Browser.close").catch(() => undefined);
      cdp.close();
    }
    browser.kill();
    server.kill();
  }
}

await main();
