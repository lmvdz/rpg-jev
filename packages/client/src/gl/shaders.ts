/**
 * The shaders (SPEC.md section 19): one lighting model shared by the terrain
 * and the glyphs. Sun, a point light on the hero, fog that closes in around
 * the followed point, foliage sway. Colours are palette indices until here.
 */
import { ATLAS_COLS, CELL_H, CELL_W, GLYPH_H, GLYPH_W } from "../glyph/font.ts";
import { PALETTE_SIZE } from "../palette.ts";
import { TEXELS_PER_TILE, TEXTURE_SIZE } from "../terrain/textures.ts";
import { PARTICLES_PER_EMITTER } from "../view/effects.ts";
import { MAX_LIGHTS } from "../view/lights.ts";
import { MAX_MOTIONS } from "../view/motions.ts";

/** Must match the offsets in `frame.ts`. */
const FRAME_BLOCK = /* glsl */ `
layout(std140) uniform Frame {
  mat4 u_viewProjection;
  vec4 u_cameraRight;   // w: time
  vec4 u_cameraUp;      // w: glyph tilt
  vec4 u_focus;
  vec4 u_sunDirection;  // w: ambient
  vec4 u_sunColor;
  vec4 u_lightPosition; // w: radius
  vec4 u_lightColor;
  vec4 u_fogColor;
  vec4 u_fog;           // start, end, glyph pixel, outline
  vec4 u_cursor;        // lit tiles: x0, z0, x1, z1
  vec4 u_palette[${PALETTE_SIZE}];
  vec4 u_lightPositions[${MAX_LIGHTS}]; // w: radius
  vec4 u_lightColours[${MAX_LIGHTS}];   // w: flicker
  vec4 u_counts;                        // x: lights in use, y: actor motions under way
  vec4 u_motionsA[${MAX_MOTIONS}];      // slot, motion, start, duration
  vec4 u_motionsB[${MAX_MOTIONS}];      // direction x and z, strength, easing
};
`;

/**
 * An actor's own motion (view/motions.ts): how far its glyph is from where
 * it stands, and how much a spin has turned it edge on, from the clock alone.
 */
const ACTOR_MOTION = /* glsl */ `
float easeOf(int kind, float a) {
  if (kind == 1) return a * a;
  if (kind == 2) return 1.0 - (1.0 - a) * (1.0 - a);
  if (kind == 3) return a * a * (3.0 - 2.0 * a);
  if (kind == 4) return sin(a * 3.14159);
  return a;
}

// lunge, hop, recoil, shake, spin: the closed set of actor motions.
vec3 actorMotion(int slot, out float facing) {
  vec3 moved = vec3(0.0);
  facing = 1.0;
  for (int i = 0; i < ${MAX_MOTIONS}; i++) {
    if (float(i) >= u_counts.y) break;
    vec4 a = u_motionsA[i];
    vec4 b = u_motionsB[i];
    float age = (u_cameraRight.w - a.z) / a.w;
    if (int(a.x) != slot || age < 0.0 || age >= 1.0) continue;
    float e = easeOf(int(b.w), age);
    float thereAndBack = sin(e * 3.14159);
    vec3 towards = vec3(b.x, 0.0, b.y);
    int motion = int(a.y);
    if (motion == 0) moved += towards * b.z * thereAndBack;
    else if (motion == 1) moved.y += b.z * 2.0 * thereAndBack;
    else if (motion == 2) moved -= towards * b.z * (1.0 - e);
    else if (motion == 3) moved += u_cameraRight.xyz * sin(age * 50.0) * b.z * 0.5 * (1.0 - age);
    else facing *= cos(e * 6.28318 * max(1.0, floor(b.z * 6.0)));
  }
  return moved;
}
`;

const LIGHTING = /* glsl */ `
vec3 pointLight(vec3 world, vec3 normal, vec4 place, vec3 colour) {
  vec3 toLight = place.xyz - world;
  float reach = length(toLight);
  float falloff = clamp(1.0 - reach / place.w, 0.0, 1.0);
  float facing = max(dot(normal, toLight / max(reach, 1e-4)), 0.0) * 0.7 + 0.3;
  return colour * falloff * falloff * facing;
}

// A flame's unsteadiness: two slow waves that never quite line up, different for each light.
float flickerOf(float which) {
  float t = u_cameraRight.w;
  return 0.5 + 0.5 * sin(t * 9.0 + which * 2.1) * sin(t * 5.3 + which * 4.7);
}

vec3 lightAt(vec3 world, vec3 normal) {
  float sun = max(dot(normal, u_sunDirection.xyz), 0.0);
  vec3 light = vec3(u_sunDirection.w) + u_sunColor.rgb * sun * 0.65;
  light += pointLight(world, normal, u_lightPosition, u_lightColor.rgb);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (float(i) >= u_counts.x) break;
    float steady = 1.0 - u_lightColours[i].w * flickerOf(float(i));
    light += pointLight(world, normal, u_lightPositions[i], u_lightColours[i].rgb) * steady;
  }
  return light;
}

float fogAt(vec3 world) {
  return smoothstep(u_fog.x, u_fog.y, distance(world.xz, u_focus.xz));
}
`;

export const TERRAIN_VERTEX = /* glsl */ `#version 300 es
${FRAME_BLOCK}
layout(location = 0) in vec3 a_position;
layout(location = 1) in vec3 a_normal;
layout(location = 2) in float a_flags;
layout(location = 3) in vec3 a_style; // ink, texture layer, shade
uniform vec3 u_origin;
out vec3 v_world;
out vec3 v_normal;
out vec3 v_color;
flat out float v_layer;
flat out float v_liquid;

void main() {
  vec3 world = a_position + u_origin;
  v_world = world;
  v_normal = a_normal;
  v_color = u_palette[int(a_style.x)].rgb * (a_style.z / 255.0);
  v_layer = a_style.y;
  v_liquid = mod(a_flags, 2.0);
  gl_Position = u_viewProjection * vec4(world, 1.0);
}
`;

export const TERRAIN_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2DArray;
${FRAME_BLOCK}
${LIGHTING}
uniform sampler2DArray u_textures;
in vec3 v_world;
in vec3 v_normal;
in vec3 v_color;
flat in float v_layer;
flat in float v_liquid;
out vec4 o_color;

void main() {
  vec3 normal = normalize(v_normal);
  vec3 facing = abs(normal);
  // Triplanar by dominant axis: no UVs are authored, and slopes need none.
  vec2 uv = v_world.xz;
  if (facing.y < facing.x || facing.y < facing.z) {
    uv = facing.x > facing.z ? v_world.zy : v_world.xy;
  }
  uv.x += v_liquid * floor(u_cameraRight.w * 2.0) / ${TEXELS_PER_TILE.toFixed(1)};
  float grey = texture(u_textures, vec3(uv * ${(TEXELS_PER_TILE / TEXTURE_SIZE).toFixed(4)}, v_layer)).r;
  vec3 color = v_color * grey * lightAt(v_world, normal);
  color = mix(color, u_fogColor.rgb, fogAt(v_world));
  // The editor's cursor: tiles inside the rectangle are lit, their rim more so.
  vec2 inside = step(u_cursor.xy, v_world.xz) * step(v_world.xz, u_cursor.zw);
  vec2 rim = min(v_world.xz - u_cursor.xy, u_cursor.zw - v_world.xz);
  float lit = inside.x * inside.y * (min(rim.x, rim.y) < 0.125 ? 0.55 : 0.18);
  o_color = vec4(mix(color, vec3(1.0), lit), 1.0);
}
`;

export const GLYPH_VERTEX = /* glsl */ `#version 300 es
${FRAME_BLOCK}
${LIGHTING}
${ACTOR_MOTION}
layout(location = 0) in vec2 a_corner;  // 0..1 across the quad
layout(location = 1) in vec3 a_anchor;  // where the glyph stands
layout(location = 2) in vec4 a_look;    // glyph, ink, flags, scale in sixteenths
out vec2 v_pixel;
out vec3 v_color;
flat out ivec2 v_cell;
flat out float v_fog;

void main() {
  float pixel = u_fog.z * a_look.w / 16.0;
  // The quad is one pixel larger than the glyph all round, for the outline.
  vec2 at = a_corner * vec2(${GLYPH_W + 2}.0, ${GLYPH_H + 2}.0) - 1.0;
  v_pixel = at;
  float sways = mod(a_look.z, 2.0);
  float wind = sin(u_cameraRight.w * 1.6 + a_anchor.x * 0.9 + a_anchor.z * 1.3);
  float lean = wind * sways * 0.35 * max(at.y, 0.0) / ${GLYPH_H}.0;
  float facingCamera;
  vec3 stands = a_anchor + actorMotion(gl_InstanceID, facingCamera);
  float acrossBy = (at.x - ${(GLYPH_W / 2).toFixed(1)}) * facingCamera + lean;
  vec3 across = stands + u_cameraRight.xyz * acrossBy * pixel;
  // Drawn facing the camera, so a glyph is never sheared or squashed, but
  // given the depth of a card standing upright on its tile, so its top does
  // not sink into the wall behind it.
  vec3 upright = normalize(mix(vec3(0.0, 1.0, 0.0), u_cameraUp.xyz, u_cameraUp.w));
  vec4 facing = u_viewProjection * vec4(across + upright * at.y * pixel, 1.0);
  vec4 standing = u_viewProjection * vec4(across + vec3(0.0, at.y * pixel, 0.0), 1.0);
  facing.z = standing.z / standing.w * facing.w;

  int glyph = int(a_look.x);
  v_cell = ivec2(glyph % ${ATLAS_COLS}, glyph / ${ATLAS_COLS}) * ivec2(${CELL_W}, ${CELL_H});
  // Glyphs stay readable in the dark: they never fall below a floor the hour sets.
  vec3 light = max(lightAt(a_anchor, vec3(0.0, 1.0, 0.0)), vec3(0.1 + u_sunDirection.w));
  float glows = mod(floor(a_look.z / 2.0), 2.0);
  vec3 ownLight = vec3(1.25 - 0.3 * flickerOf(a_anchor.x + a_anchor.z));
  v_color = u_palette[int(a_look.y)].rgb * mix(light, ownLight, glows);
  v_fog = fogAt(a_anchor);
  gl_Position = facing;
}
`;

export const GLYPH_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
${FRAME_BLOCK}
uniform sampler2D u_atlas;
in vec2 v_pixel;
in vec3 v_color;
flat in ivec2 v_cell;
flat in float v_fog;
out vec4 o_color;

float ink(ivec2 p) {
  if (p.x < 0 || p.y < 0 || p.x >= ${GLYPH_W} || p.y >= ${GLYPH_H}) return 0.0;
  return texelFetch(u_atlas, v_cell + ivec2(p.x, ${GLYPH_H - 1} - p.y), 0).r;
}

void main() {
  ivec2 p = ivec2(floor(v_pixel));
  vec3 color = v_color;
  if (ink(p) < 0.5) {
    float around = ink(p + ivec2(1, 0)) + ink(p - ivec2(1, 0))
      + ink(p + ivec2(0, 1)) + ink(p - ivec2(0, 1));
    if (u_fog.w < 0.5 || around < 0.5) discard;
    color = u_palette[0].rgb;
  }
  o_color = vec4(mix(color, u_fogColor.rgb, v_fog), 1.0);
}
`;

/**
 * Every effect row is played by this one shader. A particle keeps no state:
 * where it is, how big, which colour and which frame all follow from the
 * clock, its emitter's six texels (`view/effects.ts`) and its own number. So
 * a playing effect costs the CPU nothing, and one that was generated can do
 * nothing this shader cannot.
 */
export const EFFECT_VERTEX = /* glsl */ `#version 300 es
${FRAME_BLOCK}
${LIGHTING}
layout(location = 0) in vec2 a_corner;
uniform highp sampler2D u_emitters;
out vec2 v_pixel;
out vec3 v_color;
flat out ivec2 v_cell;
flat out float v_age;

float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }

float ease(int kind, float a) {
  if (kind == 1) return a * a;
  if (kind == 2) return 1.0 - (1.0 - a) * (1.0 - a);
  if (kind == 3) return a * a * (3.0 - 2.0 * a);
  if (kind == 4) return sin(a * 3.14159);
  return a;
}

// rise, fall, burst, drift, orbit, cling: the closed set of motions.
vec3 travel(int motion, float age, float t, float r1, float r2, float spread, float speed) {
  float angle = r1 * 6.28318;
  vec3 ring = vec3(cos(angle), 0.0, sin(angle));
  if (motion == 0) return ring * spread * r2 * (0.4 + age) + vec3(0.0, 0.2 + speed * t, 0.0);
  if (motion == 1) return ring * spread * r2 + vec3(0.0, 2.2 * (1.0 - age), 0.0);
  if (motion == 2) {
    return ring * speed * t * (0.4 + r2) + vec3(0.0, max(2.2 * speed * t - 4.0 * t * t, 0.0), 0.0);
  }
  if (motion == 3) return vec3(1.0, 0.0, 0.35) * speed * t + ring * spread * r2 + vec3(0.0, 0.15 + 0.3 * t, 0.0);
  if (motion == 4) {
    float turn = angle + age * 6.28318;
    return vec3(cos(turn), 0.0, sin(turn)) * spread + vec3(0.0, 0.6 + 0.2 * sin(turn * 2.0), 0.0);
  }
  return ring * spread * r2 + vec3(0.0, 0.2 + r1 * 0.8, 0.0);
}

void main() {
  int emitter = gl_InstanceID / ${PARTICLES_PER_EMITTER};
  float which = float(gl_InstanceID % ${PARTICLES_PER_EMITTER});
  vec4 place = texelFetch(u_emitters, ivec2(0, emitter), 0); // x, y, z, seed
  vec4 how = texelFetch(u_emitters, ivec2(1, emitter), 0);   // motion, particles, life, spread
  vec4 track = texelFetch(u_emitters, ivec2(2, emitter), 0); // speed, size from, size to, easing
  vec4 inks = texelFetch(u_emitters, ivec2(3, emitter), 0);  // three inks, glows
  vec4 frames = texelFetch(u_emitters, ivec2(4, emitter), 0);
  vec4 once = texelFetch(u_emitters, ivec2(5, emitter), 0);  // start, is an event
  // A condition's particles are born over and over, out of step with each other.
  // An event's are all born at its start and live once.
  float turn = once.y > 0.5
    ? (u_cameraRight.w - once.x) / how.z
    : u_cameraRight.w / how.z + hash(which + place.w);
  if (which >= how.y || turn < 0.0 || (once.y > 0.5 && turn >= 1.0)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  float age = fract(turn);
  float life = floor(turn);
  float r1 = hash(which * 3.1 + life * 7.7 + place.w);
  float r2 = hash(which * 5.3 + life * 1.9 + place.w + 11.0);
  vec3 at = place.xyz + travel(int(how.x), age, age * how.z, r1, r2, how.w, track.x);

  float pixel = u_fog.z * mix(track.y, track.z, ease(int(track.w), age));
  vec2 corner = a_corner * vec2(${GLYPH_W}.0, ${GLYPH_H}.0);
  v_pixel = corner;
  vec3 world = at + u_cameraRight.xyz * (corner.x - ${(GLYPH_W / 2).toFixed(1)}) * pixel
    + u_cameraUp.xyz * corner.y * pixel;

  float shown = 1.0 + step(0.0, frames.y) + step(0.0, frames.z) + step(0.0, frames.w);
  int glyph = int(frames[int(min(floor(age * shown), shown - 1.0))]);
  v_cell = ivec2(glyph % ${ATLAS_COLS}, glyph / ${ATLAS_COLS}) * ivec2(${CELL_W}, ${CELL_H});
  float ink = age < 0.34 ? inks.x : (age < 0.67 ? inks.y : inks.z);
  vec3 light = mix(lightAt(at, vec3(0.0, 1.0, 0.0)), vec3(1.2), inks.w);
  v_color = mix(u_palette[int(ink)].rgb * light, u_fogColor.rgb, fogAt(at));
  v_age = age;
  gl_Position = u_viewProjection * vec4(world, 1.0);
}
`;

export const EFFECT_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D u_atlas;
in vec2 v_pixel;
in vec3 v_color;
flat in ivec2 v_cell;
flat in float v_age;
out vec4 o_color;

void main() {
  ivec2 p = min(ivec2(floor(v_pixel)), ivec2(${GLYPH_W - 1}, ${GLYPH_H - 1}));
  if (texelFetch(u_atlas, v_cell + ivec2(p.x, ${GLYPH_H - 1} - p.y), 0).r < 0.5) discard;
  // Ink or nothing, as everywhere: a particle ends by dissolving through a screen-door.
  float door = mod(floor(gl_FragCoord.x) + 2.0 * floor(gl_FragCoord.y), 4.0) / 4.0;
  if (v_age > 0.7 && door < (v_age - 0.7) / 0.3) discard;
  o_color = vec4(v_color, 1.0);
}
`;
