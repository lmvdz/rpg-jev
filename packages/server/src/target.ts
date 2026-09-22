/** Local operational configuration. External publication is deliberately not admitted here. */
export function localTarget(env: Readonly<Record<string, string | undefined>>) {
  const portText = env.RPG_WORLD_PORT ?? "3057";
  const port = Number(portText);
  if (!/^\d{1,5}$/.test(portText) || port < 1 || port > 65535)
    throw new Error("RPG_WORLD_PORT must be an integer from 1 through 65535");
  const database = env.RPG_WORLD_DATABASE ?? "rpg-open-world";
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(database))
    throw new Error(
      "RPG_WORLD_DATABASE must be a lowercase database name of at most 64 characters",
    );
  const host = `127.0.0.1:${port}`;
  return {
    host,
    database,
    http: `http://${host}`,
    ws: `ws://${host}`,
    dataPath: port === 3057 ? [".stdb", "data"] : [".stdb", "instances", String(port), "data"],
  };
}
