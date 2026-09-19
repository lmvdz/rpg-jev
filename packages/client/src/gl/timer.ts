/**
 * GPU time per frame, where the browser offers `EXT_disjoint_timer_query_webgl2`.
 * CPU time around the draw calls says nothing about a GPU-bound frame, and
 * the R1 gate (under 4 ms a frame) is about the GPU too. Results arrive a few
 * frames late, so a small ring of queries is kept in flight.
 */
const TIME_ELAPSED = 0x88bf;
const GPU_DISJOINT = 0x8fbb;
const RING = 8;

export class GpuTimer {
  /** Latest finished measurement in milliseconds, or null if there is none. */
  latestMs: number | null = null;
  readonly supported: boolean;
  readonly #gl: WebGL2RenderingContext;
  readonly #queries: (WebGLQuery | null)[] = [];
  readonly #pending: boolean[] = [];
  #next = 0;
  #open = false;

  constructor(gl: WebGL2RenderingContext) {
    this.#gl = gl;
    this.supported = gl.getExtension("EXT_disjoint_timer_query_webgl2") !== null;
    if (!this.supported) return;
    for (let i = 0; i < RING; i++) {
      this.#queries.push(gl.createQuery());
      this.#pending.push(false);
    }
  }

  begin(): void {
    if (!this.supported) return;
    this.#collect();
    const query = this.#queries[this.#next];
    if (!query || this.#pending[this.#next]) return;
    this.#gl.beginQuery(TIME_ELAPSED, query);
    this.#open = true;
  }

  end(): void {
    if (!this.#open) return;
    this.#gl.endQuery(TIME_ELAPSED);
    this.#pending[this.#next] = true;
    this.#next = (this.#next + 1) % RING;
    this.#open = false;
  }

  #collect(): void {
    const gl = this.#gl;
    const disjoint = gl.getParameter(GPU_DISJOINT) as boolean;
    for (let i = 0; i < RING; i++) {
      const query = this.#queries[i];
      if (!(query && this.#pending[i])) continue;
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) continue;
      if (!disjoint) this.latestMs = (gl.getQueryParameter(query, gl.QUERY_RESULT) as number) / 1e6;
      this.#pending[i] = false;
    }
  }
}
