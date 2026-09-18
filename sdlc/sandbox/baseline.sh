#!/bin/sh
# A commit of the tree as it came in, so that what the stage changed can be read back as a
# patch. This repository has no remote and never leaves the container.
set -e
cd /home/agent/work
git init -q
git config user.email sandbox@localhost
git config user.name sandbox
git add -A
git commit -q -m "as it came in"
