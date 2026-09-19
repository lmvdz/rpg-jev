import { vec3 } from "gl-matrix";
import { describe, expect, it } from "vitest";
import { Camera, dampTowards } from "../src/camera.ts";
import { Frustum } from "../src/gl/frustum.ts";

function settle(step: number, seconds: number): number[] {
  const at = vec3.fromValues(0, 0, 0);
  const velocity = vec3.create();
  const goal = vec3.fromValues(10, 0, 0);
  const path: number[] = [];
  for (let t = 0; t < seconds; t += step) {
    dampTowards(at, velocity, goal, 0.25, step);
    path.push(at[0]);
  }
  return path;
}

describe("the camera's follow", () => {
  it("closes on the goal without overshooting", () => {
    const path = settle(1 / 60, 2);
    expect(Math.max(...path)).toBeLessThanOrEqual(10);
    expect(path.at(-1)).toBeCloseTo(10, 2);
    for (let i = 1; i < path.length; i++) {
      expect(path[i]).toBeGreaterThanOrEqual(path[i - 1] ?? 0);
    }
  });

  it("ends up in the same place at 30 and at 144 frames a second", () => {
    const slow = settle(1 / 30, 0.5).at(-1) ?? 0;
    const fast = settle(1 / 144, 0.5).at(-1) ?? 0;
    expect(Math.abs(slow - fast)).toBeLessThan(0.15);
  });
});

describe("the camera", () => {
  it("looks down on the followed point from its pitch and distance", () => {
    const camera = new Camera();
    const goal = vec3.fromValues(5, 1, 7);
    camera.snapTo(goal);
    camera.update(goal, 0.016, 16 / 9);
    const s = camera.settings;
    expect(vec3.distance(camera.eye, goal)).toBeCloseTo(s.distance, 4);
    expect(camera.eye[1] - goal[1]).toBeCloseTo(Math.sin(s.pitch) * s.distance, 4);
    // Yaw 0 looks north: the eye is south of the point, and right is east.
    expect(camera.eye[2]).toBeGreaterThan(goal[2]);
    expect(camera.right[0]).toBeCloseTo(1, 5);
    expect(vec3.dot(camera.right, camera.up)).toBeCloseTo(0, 5);
    expect(vec3.length(camera.up)).toBeCloseTo(1, 5);
  });
});

describe("the camera zoomed right out", () => {
  it("still sees the ground beyond the point it follows", () => {
    const camera = new Camera();
    camera.settings.distance = 400;
    const goal = vec3.fromValues(48, 0, 48);
    camera.snapTo(goal);
    camera.update(goal, 0.016, 16 / 9);
    // A point 40 tiles north of the focus is further from the eye than the focus is.
    const north = vec3.transformMat4(vec3.create(), [48, 0, 8], camera.viewProjection);
    expect(Math.abs(north[2])).toBeLessThan(1);
    expect(Math.abs(north[1])).toBeLessThan(1);
  });
});

describe("the frustum", () => {
  it("keeps what the camera sees and drops what it does not", () => {
    const camera = new Camera();
    const goal = vec3.fromValues(100, 0, 100);
    camera.snapTo(goal);
    camera.update(goal, 0.016, 16 / 9);
    const frustum = new Frustum();
    frustum.setFrom(camera.viewProjection);
    expect(frustum.intersectsBox(96, 0, 96, 128, 4, 128)).toBe(true);
    // Far behind the camera, and far off to one side.
    expect(frustum.intersectsBox(96, 0, 400, 128, 4, 432)).toBe(false);
    expect(frustum.intersectsBox(-300, 0, 96, -268, 4, 128)).toBe(false);
    // A box that holds the whole view is never culled.
    expect(frustum.intersectsBox(-1000, -1000, -1000, 1000, 1000, 1000)).toBe(true);
  });
});
