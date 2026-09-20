/** Dispatch before importing the inn/model adapters: the bench is always offline. */
if (process.argv.includes("--bench")) {
  await import("./thermal.ts");
} else {
  await import("./inn-play.ts");
}
