// The agent's only way out: one TCP pipe from the closed network to the model router on the
// host. It forwards bytes to one port of one host and knows how to do nothing else.
import net from "node:net";

const port = Number(process.argv[2]);
const target = process.argv[3] ?? "host.containers.internal";
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error("usage: relay.mjs <port> [host]");
  process.exit(2);
}

net
  .createServer((inbound) => {
    const outbound = net.connect(port, target);
    inbound.pipe(outbound).pipe(inbound);
    const drop = () => {
      inbound.destroy();
      outbound.destroy();
    };
    inbound.on("error", drop);
    outbound.on("error", drop);
  })
  .listen(port, "0.0.0.0");
