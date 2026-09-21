/**
 * Publish one local save without truncating its predecessor. This is a
 * single-writer filesystem boundary, not a multi-process locking protocol.
 */
import { randomUUID } from "node:crypto";
import {
  closeSync,
  constants,
  copyFileSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, parse } from "node:path";

/** Exclusive creation preserves earlier nights even on coarse filesystem clocks. */
function archiveSave(path: string): void {
  const { dir, name, ext } = parse(path);
  const stamp = statSync(path).mtimeMs.toFixed(0);
  for (let attempt = 0; ; attempt += 1) {
    const suffix = attempt === 0 ? "" : `.${attempt}`;
    const archive = join(dir, `${name}.${stamp}${suffix}${ext}`);
    try {
      copyFileSync(path, archive, constants.COPYFILE_EXCL);
      return;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) throw error;
    }
  }
}

export function writeSave(path: string, contents: string, archive: boolean): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  const file = openSync(temporary, "wx", 0o600);
  try {
    try {
      writeFileSync(file, contents, "utf8");
      fsyncSync(file);
    } finally {
      closeSync(file);
    }
    // Keep the current save in place until both the replacement and archive exist.
    if (archive) archiveSave(path);
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}
