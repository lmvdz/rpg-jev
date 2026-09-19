/**
 * The status display: a bar for each meter of the hero's body and a number
 * for each count, drawn from the rows it is given. The page is touched only
 * when a bar's whole-percent width or a number changes, which is rarely.
 */
import { PALETTE_HEX } from "../palette.ts";
import { type BodyView, LOW, percentOf } from "../view/body.ts";

interface Row {
  fill: HTMLElement | null;
  value: HTMLElement;
  shown: number;
}

export class StatusDisplay {
  readonly root = document.createElement("div");
  readonly #rows = new Map<string, Row>();

  constructor() {
    this.root.className = "status-bars";
    document.body.append(this.root);
  }

  #row(id: string, label: string, ink: number | null): Row {
    const known = this.#rows.get(id);
    if (known) return known;
    const line = document.createElement("div");
    line.className = "status-row";
    const name = document.createElement("span");
    // Labels come from the world, so they are set as text.
    name.textContent = label;
    const value = document.createElement("span");
    value.className = "status-value";
    let fill: HTMLElement | null = null;
    line.append(name);
    if (ink !== null) {
      const bar = document.createElement("div");
      bar.className = "status-bar";
      fill = document.createElement("div");
      fill.style.background = PALETTE_HEX[ink] ?? "#fff";
      bar.append(fill);
      line.append(bar);
    }
    line.append(value);
    this.root.append(line);
    const row: Row = { fill, value, shown: -1 };
    this.#rows.set(id, row);
    return row;
  }

  update(body: BodyView): void {
    for (const meter of body.meters) {
      const row = this.#row(meter.id, meter.label, meter.ink);
      const percent = percentOf(meter.level);
      if (percent === row.shown || !row.fill) continue;
      row.shown = percent;
      row.fill.style.width = `${percent}%`;
      row.value.textContent = String(percent);
      row.fill.parentElement?.classList.toggle("low", meter.level < LOW);
    }
    for (const count of body.counts) {
      const row = this.#row(count.id, count.label, null);
      if (count.value === row.shown) continue;
      row.shown = count.value;
      row.value.textContent = String(count.value);
    }
  }

  set visible(shown: boolean) {
    this.root.style.display = shown ? "block" : "none";
  }
}
