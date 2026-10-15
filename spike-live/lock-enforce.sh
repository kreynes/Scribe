#!/usr/bin/env bash
# Throwaway: kreynes/Scribe#24 question 1. Is a Lock held by alice enforced against bob?
#   lock-enforce.sh <seed working tree> <work dir> <alice token file> <bob token file>
# The seed tree must already be cloned from a repository on the auth-enabled loreserver
# (see README: the repository is created while the server runs without auth).
set -u
LORE="/c/Users/kreynes/lp-target/debug/lore.exe"
SEED="$1"; W="$2"; TA="$(cat "$3")"; TB="$(cat "$4")"
step() { echo; echo "=== $* ==="; }
A() { (cd "$W/alice" && "$LORE" -P "$@" --access-token "$TA"; echo "rc=$?"); }
B() { (cd "$W/bob" && "$LORE" -P "$@" --access-token "$TB"; echo "rc=$?"); }
rm -rf "$W" && mkdir -p "$W"
cp -r "$SEED" "$W/alice"; cp -r "$SEED" "$W/bob"

step "alice: lock acquire a.txt"; A lock acquire a.txt
step "bob: lock status a.txt b.txt"; B lock status a.txt b.txt
step "bob: lock query"; B lock query
step "bob: lock acquire a.txt (held by alice)"; B lock acquire a.txt
step "bob: lock release a.txt (held by alice)"; B lock release a.txt
step "alice: lock status a.txt (after bob's release attempt)"; A lock status a.txt

echo bob-edit >> "$W/bob/a.txt"
step "bob: stage a.txt (locked by alice)"; B stage a.txt
step "bob: revision commit (a.txt locked by alice)"; B commit "bob edits a locked file"
step "bob: branch push (a.txt locked by alice)"; B push
step "alice: lock status a.txt (after bob's push)"; A lock status a.txt
step "server history"; A history --remote

step "alice: sync (pull bob's change to her locked file)"; A sync
step "alice: lock release a.txt"; A lock release a.txt
