#!/bin/sh
# Everything that changed since the tree came in, tracked or new, as one binary-safe patch.
# Ignored paths (node_modules, build output) stay out because the tree's own .gitignore says so.
set -e
cd /home/agent/work
git add -A
git diff --cached --binary HEAD
