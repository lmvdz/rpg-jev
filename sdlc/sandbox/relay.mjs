// The agent's only way out: an HTTP proxy from the closed network to the model router on the
// host, one port of one host. It is also where the router's key lives. The agent's box never
// holds the key: whatever Authorization a request arrives with is replaced here, from a file
// the loop writes into this container (which holds no tree, no agent and no tools).
import { readFileSync } from "node:fs";
import http from "node:http";

const port = Number(process.argv[2]);
const target = process.argv[3] ?? "host.containers.internal";
const KEY_FILE = "/tmp/router-key";
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("usage: relay.mjs <port> [host]");
  process.exit(2);
}

const key = () => {
  try {
    return readFileSync(KEY_FILE, "utf8").trim();
  } catch {
    return "";
  }
};

http
  .createServer((inbound, reply) => {
    const headers = { ...inbound.headers, host: `${target}:${port}` };
    delete headers.authorization;
    const secret = key();
    if (secret) headers.authorization = `Bearer ${secret}`;
    const outbound = http.request(
      { host: target, port, method: inbound.method, path: inbound.url, headers },
      (answer) => {
        reply.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(reply);
      },
    );
    outbound.on("error", () => {
      if (!reply.headersSent) reply.writeHead(502);
      reply.end();
    });
    inbound.pipe(outbound);
  })
  .listen(port, "0.0.0.0");
