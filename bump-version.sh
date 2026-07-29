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
echo "Bumped all module URLs to ?v=$V"
