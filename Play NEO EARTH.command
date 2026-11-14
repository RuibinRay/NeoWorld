#!/bin/bash
# Double-click to play: starts the game's server if it is not already running, then opens the game.
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! curl -s -o /dev/null http://localhost:5226/; then
  [ -d node_modules ] || npm install
  nohup npm run dev > /tmp/neo-earth-dev.log 2>&1 &
  for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:5226/ && break; sleep 0.5; done
fi
open http://localhost:5226/
