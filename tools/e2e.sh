#!/usr/bin/env bash
# Local e2e runner for people and agents (ADR-0046).
# - One Playwright run per machine at a time: a second run waits for the lock instead of
#   competing for the CPU (four parallel SwiftShader runs pushed the load to 20 and turned
#   every test into a timeout or a "Target crashed").
# - Each checkout gets its own preview port, so worktrees never reuse each other's server.
# - Needs explicit spec files; the full suite is CI's job (pass --all to run it anyway).
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ $# -eq 0 ]]; then
  echo "usage: tools/e2e.sh e2e/<spec>.spec.ts [...] [playwright args] | --all" >&2
  exit 2
fi
args=("$@")
if [[ "${args[0]}" == "--all" ]]; then
  args=("${args[@]:1}")
fi

# A stable port per checkout, 4200-4799.
sum=$(printf '%s' "$PWD" | cksum | cut -d' ' -f1)
export E2E_PORT="${E2E_PORT:-$((4200 + sum % 600))}"

lock="${TMPDIR:-/tmp}/seki-e2e.lock"
exec 9>"$lock"
if ! flock -n 9; then
  echo "e2e: another run holds $lock, waiting for it..." >&2
  flock 9
fi

echo "e2e: port $E2E_PORT, load $(cut -d' ' -f1 /proc/loadavg 2>/dev/null || echo ?)" >&2
exec pnpm exec playwright test "${args[@]}"
