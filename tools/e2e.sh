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

# A stable port per checkout, 4200-4799. Playwright reuses whatever already listens there
# (`reuseExistingServer`), so a preview left by another checkout would be measured instead
# of this one: a port held by someone else's server moves on to the next one.
own_app="$PWD/packages/app"
listener_dir() {
  local pid
  pid=$(lsof -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -n1 || true)
  [[ -z "$pid" ]] && return 1
  readlink "/proc/$pid/cwd" 2>/dev/null || echo "?"
}
if [[ -z "${E2E_PORT:-}" ]]; then
  sum=$(printf '%s' "$PWD" | cksum | cut -d' ' -f1)
  port=$((4200 + sum % 600))
  for _ in $(seq 1 50); do
    if ! dir=$(listener_dir "$port") || [[ "$dir" == "$own_app" ]]; then break; fi
    echo "e2e: port $port is held by $dir, trying the next one" >&2
    port=$((port + 1))
  done
  export E2E_PORT="$port"
elif dir=$(listener_dir "$E2E_PORT") && [[ "$dir" != "$own_app" ]]; then
  echo "e2e: E2E_PORT=$E2E_PORT is held by a server of $dir, not of this checkout" >&2
  exit 3
fi

lock="${TMPDIR:-/tmp}/seki-e2e.lock"
exec 9>"$lock"
if ! flock -n 9; then
  echo "e2e: another run holds $lock, waiting for it..." >&2
  flock 9
fi

echo "e2e: port $E2E_PORT, load $(cut -d' ' -f1 /proc/loadavg 2>/dev/null || echo ?)" >&2
exec pnpm exec playwright test "${args[@]}"
