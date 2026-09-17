# Spike S0: does SpacetimeDB hold as the world server?

Not started. The full brief is in [SPEC.md](../../SPEC.md), section 15.

A small TypeScript module with:

- one reducer and one event-log table;
- scheduled fuses under load;
- a Jev worker doing the request-and-commit loop, with a precondition that fails on purpose;
- a browser client subscribed to rows near a position, with the subscription cost measured as rows change;
- a bitemporal edge query;
- a measurement of how fast closed edge rows grow in memory, which sets the archival policy.

If S0 fails, the fallback is a Node server with embedded SurrealDB. Table schemas stay identical on purpose, so the fallback is a swap and not a rewrite.

Needs the SpacetimeDB CLI, which is not installed yet.
