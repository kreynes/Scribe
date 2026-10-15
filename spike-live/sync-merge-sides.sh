#!/usr/bin/env bash
# Throwaway: kreynes/Scribe#24 question 4, minimal and unambiguous. Against an unauthenticated loreserver.
#   sync-merge-sides.sh <work dir>
# remote-side pushes f.txt=REMOTE (and g.txt), local-side commits f.txt=LOCAL without pushing,
# then local-side syncs. Which content does `resolve mine` keep?
set -u
D="/c/Users/kreynes/lp-target/debug"; L="$D/lore.exe"; P="$D/live-probe.exe"
W="$1"; U="lore://127.0.0.1:41337/q4-$RANDOM"
rm -rf "$W"; mkdir -p "$W/r" && cd "$W/r" || exit 1
$L -P repository create "$U" --identity r >/dev/null
echo "BASE" > f.txt; echo "g base" > g.txt
$L -P stage f.txt g.txt >/dev/null; $L -P commit base >/dev/null; $L -P push >/dev/null
cd "$W" && $L -P clone "$U" remote-side --identity rs >/dev/null && $L -P clone "$U" local-side --identity ls >/dev/null
cd "$W/remote-side" && echo "REMOTE" > f.txt && echo "g remote" > g.txt
$L -P stage f.txt g.txt >/dev/null; $L -P commit "remote" >/dev/null; $L -P push >/dev/null
cd "$W/local-side" && echo "LOCAL" > f.txt
$L -P stage f.txt >/dev/null; $L -P commit "local" >/dev/null
echo "== library sync on local-side (raw events) =="
LIVE_PROBE_LOG=1 "$P" sync "$W/local-side"
cd "$W/local-side"; $L -P status
echo "-- f.txt:"; cat f.txt; echo "-- g.txt (non-conflicting remote change):"; cat g.txt
cp -r "$W/local-side" "$W/local-side-t"
$L -P branch merge resolve mine f.txt >/dev/null; echo "after resolve mine:   $(cat f.txt)"
(cd "$W/local-side-t" && $L -P branch merge resolve theirs f.txt >/dev/null; echo "after resolve theirs: $(cat f.txt)")
echo "== commit the merge (resolved mine) and push =="
$L -P commit "merge" | grep -E "Revision|Parent|Commit"; $L -P push | tail -1
echo "-- server history"; $L -P history --remote | grep -E "Revision|Signature|    "
