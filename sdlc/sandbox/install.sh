#!/bin/sh
# Dependencies come from the store baked into the image: no network, no lifecycle scripts.
cd /work
if pnpm install --offline --frozen-lockfile --ignore-scripts --store-dir /opt/pnpm-store >/tmp/install.log 2>&1; then
  exit 0
fi
tail -n 20 /tmp/install.log
echo "The sandbox image's package store does not match pnpm-lock.yaml. Rebuild it: pnpm sdlc sandbox-build"
exit 1
