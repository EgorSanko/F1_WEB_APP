#!/bin/bash
# Прогрев career-кэша для пилотов и команд сезона 2026.
# Запускается по cron каждые 30 минут.
# Логи: /var/log/f1hub-prewarm.log

set -u
LOG="/var/log/f1hub-prewarm.log"
BASE="http://127.0.0.1:8002"  # внутренний endpoint, в обход nginx и rate-limit

DRIVERS=(
  max_verstappen hamilton leclerc norris piastri russell
  antonelli alonso stroll gasly colapinto albon
  sainz ocon bearman lawson hulkenberg hadjar
  bortoleto lindblad perez bottas
)

TEAMS=(
  mercedes ferrari mclaren red_bull williams
  rb aston_martin alpine haas sauber
)

ts=$(date "+%Y-%m-%d %H:%M:%S")
echo "[$ts] prewarm start" >> "$LOG"

ok=0; fail=0
for d in "${DRIVERS[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/driver/career/$d" -m 60)
  if [ "$code" = "200" ]; then ok=$((ok+1)); else fail=$((fail+1)); echo "  driver/$d -> $code" >> "$LOG"; fi
done

for t in "${TEAMS[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/team/career/$t" -m 60)
  if [ "$code" = "200" ]; then ok=$((ok+1)); else fail=$((fail+1)); echo "  team/$t -> $code" >> "$LOG"; fi
done

ts=$(date "+%Y-%m-%d %H:%M:%S")
echo "[$ts] prewarm done  ok=$ok fail=$fail" >> "$LOG"
