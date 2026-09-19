/**
 * Everything drawn as a glyph, packed for one instanced draw call
 * (SPEC.md section 19, step R2). An instance is 16 bytes: where it stands
 * (f32 x3), then glyph, ink, flags and scale (u8 x4).
 */
export const INSTANCE_BYTES = 16;
export const GLYPH_SWAYS = 1;
/** Gives its own light: drawn at full brightness whatever the hour, and flickering. */
export const GLYPH_GLOWS = 2;
/** Surface treatments keep the atlas's ink mask, so drawing and picking still agree. */
export const GLYPH_WET = 4;
export const GLYPH_DAMAGED = 8;
/** Scale is in sixteenths, so 16 draws a glyph pixel at the frame's `glyphPixel`. */
export const SCALE_ONE = 16;

export interface GlyphLook {
  glyph: number;
  ink: number;
  flags?: number;
  scale?: number;
}

/** Changes are tracked and uploaded in pages of this many instances (4 KB). */
const PAGE = 256;

export class GlyphBatch {
  #bytes: Uint8Array;
  #floats: Float32Array;
  count = 0;
  /** Instances in [dirtyFrom, dirtyTo) may have changed since `clean()`; `#pages` says which did. */
  dirtyFrom = 0;
  dirtyTo = 0;
  #pages = new Uint8Array(16);

  constructor(capacity: number) {
    const buffer = new ArrayBuffer(Math.max(capacity, 1) * INSTANCE_BYTES);
    this.#bytes = new Uint8Array(buffer);
    this.#floats = new Float32Array(buffer);
  }

  /** The packed instances. A new array after the batch has grown, so do not hold on to it. */
  get bytes(): Uint8Array {
    return this.#bytes;
  }

  get capacity(): number {
    return this.#bytes.byteLength / INSTANCE_BYTES;
  }

  /** Appends an instance and returns its slot. The batch doubles when it is full. */
  add(x: number, y: number, z: number, look: GlyphLook): number {
    if (this.count >= this.capacity) this.#grow();
    const slot = this.count++;
    this.move(slot, x, y, z);
    this.setLook(slot, look);
    return slot;
  }

  /**
   * Frees a slot by moving the last instance into it. Returns the slot that
   * instance used to have (the caller's index of it is now stale), or -1
   * when the removed instance was itself the last.
   */
  remove(slot: number): number {
    const last = this.count - 1;
    if (slot < 0 || slot > last) throw new Error(`the batch has no slot ${slot}`);
    this.count = last;
    if (slot === last) return -1;
    this.#bytes.copyWithin(
      slot * INSTANCE_BYTES,
      last * INSTANCE_BYTES,
      (last + 1) * INSTANCE_BYTES,
    );
    this.#touch(slot);
    return last;
  }

  move(slot: number, x: number, y: number, z: number): void {
    const f = (slot * INSTANCE_BYTES) / 4;
    this.#floats[f] = x;
    this.#floats[f + 1] = y;
    this.#floats[f + 2] = z;
    this.#touch(slot);
  }

  setHeight(slot: number, y: number): void {
    this.#floats[(slot * INSTANCE_BYTES) / 4 + 1] = y;
    this.#touch(slot);
  }

  setLook(slot: number, look: GlyphLook): void {
    const b = slot * INSTANCE_BYTES + 12;
    this.#bytes[b] = look.glyph;
    this.#bytes[b + 1] = look.ink;
    this.#bytes[b + 2] = look.flags ?? 0;
    this.#bytes[b + 3] = look.scale ?? SCALE_ONE;
    this.#touch(slot);
  }

  setInk(slot: number, ink: number): void {
    this.#bytes[slot * INSTANCE_BYTES + 13] = ink;
    this.#touch(slot);
  }

  #grow(): void {
    const buffer = new ArrayBuffer(this.#bytes.byteLength * 2);
    const bytes = new Uint8Array(buffer);
    bytes.set(this.#bytes);
    this.#bytes = bytes;
    this.#floats = new Float32Array(buffer);
  }

  /**
   * Calls `upload(fromSlot, toSlot)` for each run of changed pages. A world
   * that changes a little everywhere would otherwise send the whole buffer
   * every frame: its first and last changed slots are far apart, and nearly
   * everything between them is as the GPU already has it.
   */
  forEachDirtyRun(upload: (fromSlot: number, toSlot: number) => void): void {
    if (this.dirtyFrom === this.dirtyTo) return;
    const first = Math.floor(this.dirtyFrom / PAGE);
    const last = Math.floor((this.dirtyTo - 1) / PAGE);
    let runStart = -1;
    for (let page = first; page <= last + 1; page++) {
      const dirty = page <= last && this.#pages[page] === 1;
      if (dirty && runStart < 0) runStart = page;
      if (!dirty && runStart >= 0) {
        const to = Math.min(page * PAGE, this.count);
        if (to > runStart * PAGE) upload(runStart * PAGE, to);
        runStart = -1;
      }
    }
  }

  #touch(slot: number): void {
    const page = Math.floor(slot / PAGE);
    if (page >= this.#pages.length) {
      const pages = new Uint8Array(Math.max(page + 1, this.#pages.length * 2));
      pages.set(this.#pages);
      this.#pages = pages;
    }
    this.#pages[page] = 1;
    if (this.dirtyFrom === this.dirtyTo) {
      this.dirtyFrom = slot;
      this.dirtyTo = slot + 1;
      return;
    }
    if (slot < this.dirtyFrom) this.dirtyFrom = slot;
    if (slot >= this.dirtyTo) this.dirtyTo = slot + 1;
  }

  clean(): void {
    this.dirtyFrom = 0;
    this.dirtyTo = 0;
    this.#pages.fill(0);
  }

  markAllDirty(): void {
    this.dirtyFrom = 0;
    this.dirtyTo = this.count;
    this.#pages.fill(1);
  }
}
