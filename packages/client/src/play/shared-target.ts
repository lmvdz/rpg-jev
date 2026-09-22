/** Operator build configuration, never imported character/world content. */
export interface SharedTarget {
  uri: string;
  database: string;
  storageKey: string;
}

export function sharedTarget(
  uri = "ws://127.0.0.1:3057",
  database = "rpg-open-world",
): SharedTarget {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(database))
    throw new Error("Invalid shared-world database name");
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new Error("Invalid shared-world endpoint");
  }
  if (
    uri.trim() !== uri ||
    !["ws:", "wss:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Shared-world endpoint must be a WebSocket origin without credentials");
  if (url.protocol === "ws:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Remote shared-world endpoints require wss");
  const origin = url.origin;
  return { uri: origin, database, storageKey: `rpg-jev.shared.v1:${origin}:${database}` };
}
