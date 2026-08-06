#!/bin/sh
# Cache-busting: rewrite every ?v=<n> across index.html and js modules.
# Run before each deploy so browsers fetch the latest files:  ./bump-version.sh 2
set -e
V="$1"
[ -z "$V" ] && { echo "usage: ./bump-version.sh <version>   e.g. ./bump-version.sh 2"; exit 1; }
cd "$(dirname "$0")"
# BSD (macOS) and GNU sed both accept: sed -i.bak ... then remove backups
for f in index.html js/*.js js/games/*.js; do
  sed -i.bak -E "s/\?v=[0-9]+/?v=$V/g" "$f" && rm -f "$f.bak"
done
# service worker cache name -> forces offline cache refresh on new release
sed -i.bak -E "s/arcade-v[0-9]+/arcade-v$V/" sw.js && rm -f sw.js.bak

# Regenerate the offline precache module list in sw.js (between the MODULES markers)
# so every JS module ships in the app shell — otherwise the app can't boot offline
# after a cache-version bump wipes the runtime cache.
MODS=""
for f in js/*.js js/games/*.js; do
  MODS="$MODS  './$f?v=$V',\n"
done
awk -v mods="$MODS" '
  /MODULES:START/ { print; printf "%s", mods; skip=1; next }
  /MODULES:END/   { skip=0 }
  skip==1 { next }
  { print }
' sw.js > sw.js.tmp && mv sw.js.tmp sw.js

echo "Bumped module URLs and SW cache to v=$V; regenerated offline precache list"
