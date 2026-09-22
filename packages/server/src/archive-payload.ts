import { gunzipSync, gzipSync } from "node:zlib";

export const ARCHIVE_PAYLOAD_ENCODING = "gzip-base64-v1";
export const MAX_STORED_PAYLOAD_BYTES = 1024 * 1024;
export const MAX_DECODED_PAYLOAD_BYTES = 16 * 1024 * 1024;

export interface StoredArchivePayload {
  payload: string;
  encoding?: typeof ARCHIVE_PAYLOAD_ENCODING;
}

function bounded(payload: string, limit: number): void {
  if (
    typeof payload !== "string" ||
    payload.length > limit ||
    Buffer.byteLength(payload, "utf8") > limit
  )
    throw new Error("Archive payload limit exceeded.");
}

/**
 * Node archive storage only. V1 is canonical base64 of gzip of the original
 * payload's UTF-8 bytes. Compression is not confidentiality or authentication.
 * Unpaired UTF-16 surrogates cannot round-trip through UTF-8: keep those raw.
 * Compare the entire serialized field pair, including the encoding marker.
 * The journal must additionally enforce its complete serialized row limit.
 */
export function encodeArchivePayload(payload: string): StoredArchivePayload {
  bounded(payload, MAX_DECODED_PAYLOAD_BYTES);
  const raw = { payload };
  const input = Buffer.from(payload, "utf8");
  if (input.toString("utf8") !== payload) {
    bounded(payload, MAX_STORED_PAYLOAD_BYTES);
    return raw;
  }
  const compressed: StoredArchivePayload = {
    payload: gzipSync(input).toString("base64"),
    encoding: ARCHIVE_PAYLOAD_ENCODING,
  };
  const encodedBytes = Buffer.byteLength(JSON.stringify(compressed));
  if (encodedBytes < Buffer.byteLength(JSON.stringify(raw))) {
    bounded(compressed.payload, MAX_STORED_PAYLOAD_BYTES);
    return compressed;
  }
  bounded(payload, MAX_STORED_PAYLOAD_BYTES);
  return raw;
}

/** Decode one row independently; unknown versions and corrupt/bomb data are fatal. */
export function decodeArchivePayload(row: { payload: string; encoding?: unknown }): string {
  bounded(row.payload, MAX_STORED_PAYLOAD_BYTES);
  if (row.encoding === undefined) return row.payload;
  if (row.encoding !== ARCHIVE_PAYLOAD_ENCODING)
    throw new Error("Unknown archive payload encoding.");
  if (
    row.payload.length === 0 ||
    row.payload.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(row.payload)
  )
    throw new Error("Invalid archive payload base64.");
  const input = Buffer.from(row.payload, "base64");
  if (input.toString("base64") !== row.payload)
    throw new Error("Noncanonical archive payload base64.");
  // Native zlib verifies gzip checksums and aborts inflation at this output bound.
  const output = gunzipSync(input, { maxOutputLength: MAX_DECODED_PAYLOAD_BYTES });
  // BOM is payload data, not a file signature; preserve it along with every code point.
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(output);
}
