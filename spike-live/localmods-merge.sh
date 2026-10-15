#!/usr/bin/env bash
# Throwaway: kreynes/Scribe#24 questions 2 and 4, against an unauthenticated loreserver.
#   localmods-merge.sh <work dir>
# Q2: sync / branch switch over uncommitted local edits that the target changes.
# Q4: sync over diverged committed history: which side is `mine`?
set -u
D="/c/Users/kreynes/lp-target/debug"
LORE="$D/lore.exe"; PROBE="$D/live-probe.exe"
W="$1"; URL="lore://127.0.0.1:41337/lm-$RANDOM"
step() { echo; echo "=== $* ==="; }
X() { (cd "$W/x" && "$LORE" -P "$@"; echo "rc=$?"); }
Y() { (cd "$W/y" && "$LORE" -P "$@"; echo "rc=$?"); }
rm -rf "$W" && mkdir -p "$W/x" && cd "$W/x" || exit 1
"$LORE" -P repository create "$URL" --identity xavier@scribe.test >/dev/null
for f in a b c; do echo "$f base" > $f.txt; done
X stage a.txt b.txt c.txt >/dev/null; X commit base >/dev/null; X push | tail -1
(cd "$W" && "$LORE" -P clone "$URL" y --identity yvonne@scribe.test | tail -1)

echo; echo "################ Q2: LocalModifications ################"
step "x: change a.txt and b.txt, add d.txt, push revision 2"
echo "a from x" > "$W/x/a.txt"; echo "b from x" > "$W/x/b.txt"; echo "d new" > "$W/x/d.txt"
X stage a.txt b.txt d.txt >/dev/null; X commit "x edits a b, adds d" >/dev/null; X push | tail -1
step "y: uncommitted edits to a.txt and c.txt (a clashes with revision 2, c does not); untracked d.txt clashes with x's added d.txt"
echo "a local edit" > "$W/y/a.txt"; echo "c local edit" > "$W/y/c.txt"; echo "d local untracked" > "$W/y/d.txt"
Y status
step "y: CLI sync"; Y sync
step "y: library sync (raw events)"; "$PROBE" sync "$W/y"
step "y: same, but only c.txt dirty (no clash)"
cp -r "$W/y" "$W/y-noclash"; (cd "$W/y-noclash" && "$LORE" -P reset a.txt >/dev/null; rm -f d.txt)
"$PROBE" sync "$W/y-noclash"; (cd "$W/y-noclash" && "$LORE" -P status; cat c.txt)

step "x: branch create feature (changes b.txt), push"
X branch create feature >/dev/null; echo "b on feature" > "$W/x/b.txt"
X stage b.txt >/dev/null; X commit "feature edits b" >/dev/null; X push | tail -1
step "y-sw: fresh clone at main tip, uncommitted edit to b.txt"
(cd "$W" && "$LORE" -P clone "$URL" y-sw --identity yvonne@scribe.test | tail -1)
echo "b local edit" > "$W/y-sw/b.txt"
step "y-sw: CLI branch switch feature"; (cd "$W/y-sw" && "$LORE" -P branch switch feature; echo "rc=$?")
step "y-sw: library branch switch feature (raw events)"; "$PROBE" switch "$W/y-sw" feature

echo; echo "################ Q4: sync over diverged history ################"
(cd "$W" && "$LORE" -P clone "$URL" p --identity xavier@scribe.test | tail -1)
(cd "$W" && "$LORE" -P clone "$URL" q --identity yvonne@scribe.test | tail -1)
P() { (cd "$W/p" && "$LORE" -P "$@"; echo "rc=$?"); }
Q() { (cd "$W/q" && "$LORE" -P "$@"; echo "rc=$?"); }
step "p: commit 'a from p' and push (this is THEIRS from q's point of view)"
echo "a from p (pushed)" > "$W/p/a.txt"; P stage a.txt >/dev/null; P commit "p edits a" >/dev/null; P push | tail -1
step "q: commit 'a from q' locally, do not push (this is q's own work)"
echo "a from q (local commit)" > "$W/q/a.txt"; Q stage a.txt >/dev/null; Q commit "q edits a" >/dev/null
step "q: CLI sync"; Q sync
step "q: status after sync"; Q status
step "q: a.txt after sync"; cat "$W/q/a.txt"
cp -r "$W/q" "$W/q-theirs"
step "q: branch merge resolve mine a.txt"; Q branch merge resolve mine a.txt
step "q: a.txt after resolve mine"; cat "$W/q/a.txt"
step "q-theirs: branch merge resolve theirs a.txt"; (cd "$W/q-theirs" && "$LORE" -P branch merge resolve theirs a.txt; echo "rc=$?"; cat a.txt)
