#!/usr/bin/env bash
# TrustLens dev script — use for ALL start/stop/maintenance
# Usage: bash scripts/dev.sh [start|stop|restart|status|logs|test-apis|clean|build]

set -e
cd "$(dirname "$0")/.."

LOG_FILE=".next/dev.log"
PID_FILE=".next/dev.pid"
PORT=3000

cmd="${1:-help}"

# ─── helpers ────────────────────────────────────────────────────────────────
log()  { echo "[$(date '+%H:%M:%S')] $*"; }
ok()   { echo "  ✅ $*"; }
fail() { echo "  ❌ $*"; }
info() { echo "  ℹ  $*"; }

is_running() {
  if [ -f "$PID_FILE" ]; then
    pid=$(cat "$PID_FILE")
    kill -0 "$pid" 2>/dev/null && return 0
  fi
  # also check by port
  netstat -ano 2>/dev/null | grep -q ":$PORT " && return 0
  return 1
}

# ─── commands ───────────────────────────────────────────────────────────────
cmd_start() {
  if is_running; then
    log "Already running on port $PORT — use 'restart' to reload"
    return
  fi
  log "Starting TrustLens dev server (turbopack)..."
  mkdir -p .next
  nohup npx next dev --turbopack --port $PORT > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 5
  if is_running; then
    ok "Server running at http://localhost:$PORT  (pid $(cat $PID_FILE))"
    info "Logs: bash scripts/dev.sh logs"
  else
    fail "Server failed to start — check logs:"
    tail -20 "$LOG_FILE"
  fi
}

cmd_stop() {
  log "Stopping TrustLens dev server..."
  if [ -f "$PID_FILE" ]; then
    pid=$(cat "$PID_FILE")
    kill "$pid" 2>/dev/null && ok "Killed pid $pid" || info "Process already gone"
    rm -f "$PID_FILE"
  fi
  # also kill any lingering next dev processes on this port
  if command -v pkill &>/dev/null; then
    pkill -f "next dev" 2>/dev/null || true
  fi
  ok "Stopped"
}

cmd_restart() {
  cmd_stop
  sleep 1
  cmd_start
}

cmd_status() {
  if is_running; then
    pid=$(cat "$PID_FILE" 2>/dev/null || echo "?")
    ok "Running  http://localhost:$PORT  (pid $pid)"
  else
    fail "Not running"
  fi
}

cmd_logs() {
  if [ ! -f "$LOG_FILE" ]; then
    fail "No log file yet — run 'start' first"
    exit 1
  fi
  tail -f "$LOG_FILE"
}

cmd_build() {
  log "Building production bundle..."
  npx next build 2>&1
  ok "Build complete"
}

cmd_clean() {
  log "Clearing .next cache..."
  cmd_stop 2>/dev/null || true
  rm -rf .next
  ok "Cache cleared — run 'start' to rebuild"
}

cmd_test_apis() {
  log "Testing all TrustLens API endpoints..."

  # load env
  [ -f .env.local ] && export $(grep -v '^#' .env.local | grep '=' | xargs) 2>/dev/null || true

  # ZooWork models
  code=$(curl -s -o /tmp/zw.json -w "%{http_code}" --connect-timeout 6 \
    "https://clawapi.ecap.gsmo.ai/service/v1/models" \
    -H "Authorization: Bearer $ZOOWORK_API_KEY" 2>&1)
  if [ "$code" = "200" ]; then
    count=$(node -e "console.log(JSON.parse(require('fs').readFileSync('/tmp/zw.json','utf8')).length)" 2>/dev/null || echo "?")
    ok "ZooWork /models  →  $count models available"
  else
    fail "ZooWork /models  →  HTTP $code"
  fi

  # Nebius chat
  code=$(curl -s -o /tmp/nb.json -w "%{http_code}" --connect-timeout 8 \
    -X POST "https://api.studio.nebius.com/v1/chat/completions" \
    -H "Authorization: Bearer $NEBIUS_API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model":"Qwen/Qwen3-30B-A3B-Instruct-2507","messages":[{"role":"user","content":"Reply: OK"}],"max_tokens":3}' 2>&1)
  [ "$code" = "200" ] && ok "Nebius chat  →  OK" || fail "Nebius chat  →  HTTP $code"

  # Tavily
  code=$(curl -s -o /tmp/tv.json -w "%{http_code}" --connect-timeout 8 \
    -X POST "https://api.tavily.com/search" \
    -H "Content-Type: application/json" \
    -d "{\"api_key\":\"$TAVILY_API_KEY\",\"query\":\"test\",\"max_results\":1}" 2>&1)
  [ "$code" = "200" ] && ok "Tavily search  →  OK" || fail "Tavily search  →  HTTP $code"

  # TinyFish (best-effort)
  code=$(curl -s -o /tmp/tf.json -w "%{http_code}" --connect-timeout 6 \
    "https://api.search.tinyfish.ai/search?q=test&limit=1" \
    -H "X-API-Key: $TINYFISH_API_KEY" \
    -H "Accept: application/json" 2>&1)
  if [ "$code" = "200" ]; then
    if grep -q '"results"' /tmp/tf.json 2>/dev/null; then
      ok "TinyFish search  →  JSON OK"
    else
      info "TinyFish search  →  HTTP 200 but returned HTML (path still unclear)"
    fi
  else
    fail "TinyFish search  →  HTTP $code"
  fi

  # Local dev server
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 \
    "http://localhost:$PORT" 2>&1)
  [ "$code" = "200" ] && ok "Local http://localhost:$PORT  →  UP" || info "Local dev server  →  not running (start it first)"

  log "Done."
}

# ─── dispatch ───────────────────────────────────────────────────────────────
case "$cmd" in
  start)     cmd_start ;;
  stop)      cmd_stop ;;
  restart)   cmd_restart ;;
  status)    cmd_status ;;
  logs)      cmd_logs ;;
  build)     cmd_build ;;
  clean)     cmd_clean ;;
  test-apis) cmd_test_apis ;;
  help|*)
    echo ""
    echo "  TrustLens dev script"
    echo ""
    echo "  Usage: bash scripts/dev.sh <command>"
    echo ""
    echo "  Commands:"
    echo "    start      Start dev server (turbopack, port $PORT)"
    echo "    stop       Stop dev server"
    echo "    restart    Stop + start"
    echo "    status     Is it running?"
    echo "    logs       Tail dev server logs"
    echo "    build      Build production bundle"
    echo "    clean      Delete .next cache and stop"
    echo "    test-apis  Health-check all API keys"
    echo ""
    ;;
esac
