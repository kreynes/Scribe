#!/usr/bin/env bash
# Throwaway: kreynes/Scribe#13 question 2. Do commit / amend / push release the committer's locks?
set -u
LORE="/c/Users/kreynes/lp-target/debug/lore.exe"
W="$1"   # empty work dir
URL="lore://127.0.0.1:41337/locktest-$RANDOM"
step() { echo; echo "=== $* ==="; }
mkdir -p "$W" && cd "$W" || exit 1
step create "$URL"; "$LORE" -P repository create "$URL" --identity probe@scribe.test
echo one > a.txt; echo one > b.txt
"$LORE" -P stage a.txt b.txt && "$LORE" -P commit "init" && "$LORE" -P push
step "lock acquire a.txt b.txt"; "$LORE" -P lock acquire a.txt b.txt
step "lock status (before)"; "$LORE" -P lock status a.txt b.txt
echo two >> a.txt; "$LORE" -P stage a.txt
step "revision commit"; "$LORE" -P commit "edit a"
step "lock status (after commit)"; "$LORE" -P lock status a.txt b.txt
step "revision amend"; "$LORE" -P revision amend "edit a (amended)"
step "lock status (after amend)"; "$LORE" -P lock status a.txt b.txt
step "branch push"; "$LORE" -P push
step "lock status (after push)"; "$LORE" -P lock status a.txt b.txt
step "lock query (all)"; "$LORE" -P lock query
step "lock release a.txt"; "$LORE" -P lock release a.txt
step "lock status (after explicit release)"; "$LORE" -P lock status a.txt b.txt
