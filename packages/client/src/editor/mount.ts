/**
 * The editor's hands: mouse and keys on the page turned into calls on the
 * session. Everything that decides what an edit is lives in the session and
 * its tools; this only reports which tile, which button, and which key.
 */
import type { Camera } from "../camera.ts";
import type { EditorPanel } from "./panel.ts";
import { pickTile } from "./picking.ts";
import type { EditorSession } from "./session.ts";
import { TOOLS } from "./tools.ts";

export interface EditorHost {
  canvas: HTMLCanvasElement;
  camera: Camera;
  session: EditorSession;
  panel: EditorPanel;
  editing(): boolean;
  save(): void;
  heroHere(): void;
}

export interface MountedEditor {
  /** Call once a frame while editing: the tile under the mouse changes when the camera moves too. */
  track(): void;
  /** Handles an editor key. True when the key was the editor's. */
  key(event: KeyboardEvent): boolean;
}

export function mountEditor(host: EditorHost): MountedEditor {
  const { canvas, camera, session, panel } = host;
  const mouse = { x: 0, y: 0, over: false };

  canvas.addEventListener("mousemove", (event) => {
    const box = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - box.left) / box.width) * 2 - 1;
    mouse.y = 1 - ((event.clientY - box.top) / box.height) * 2;
    mouse.over = true;
  });
  canvas.addEventListener("mouseleave", () => {
    mouse.over = false;
  });
  canvas.addEventListener("mousedown", (event) => {
    if (!host.editing() || (event.button !== 0 && event.button !== 2)) return;
    event.preventDefault();
    session.begin(session.hover, event.button === 2, event.shiftKey);
    panel.refresh();
  });
  window.addEventListener("mouseup", () => {
    if (!session.busy) return;
    session.end();
    panel.refresh();
  });
  canvas.addEventListener("contextmenu", (event) => {
    if (host.editing()) event.preventDefault();
  });
  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!host.editing()) return;
      event.preventDefault();
      const s = camera.settings;
      s.distance = Math.min(Math.max(s.distance * (event.deltaY > 0 ? 1.12 : 1 / 1.12), 8), 400);
    },
    { passive: false },
  );

  const chords: Readonly<Record<string, () => void>> = {
    z: () => session.undo(),
    y: () => session.redo(),
    s: host.save,
  };
  const plain: Readonly<Record<string, () => void>> = {
    h: host.heroHere,
    "[": () => {
      session.brush.size = Math.max(session.brush.size - 1, 1);
    },
    "]": () => {
      session.brush.size = Math.min(session.brush.size + 1, 15);
    },
  };

  return {
    track() {
      const over = mouse.over || session.busy;
      const tile = over
        ? pickTile(session.world.grid, camera.viewProjection, mouse.x, mouse.y)
        : -1;
      if (tile === session.hover) return;
      session.moveTo(tile);
      panel.status();
    },
    key(event) {
      const key = event.key.toLowerCase();
      const tool = TOOLS.find((candidate) => candidate.key === key);
      const run = event.ctrlKey || event.metaKey ? chords[key] : plain[key];
      if (tool && !event.ctrlKey) session.tool = tool;
      else if (run) run();
      else return false;
      event.preventDefault();
      panel.refresh();
      return true;
    },
  };
}
