#!/bin/bash
set -euo pipefail

cd /opt/f1-hub

echo "=== F1 Hub Deploy ==="
date "+%Y-%m-%d %T"

# 1. Git status check
if [[ -n "$(git status --porcelain)" ]]; then
    echo "Warning: Working tree dirty. Commit or stash first."
    git status --short
    read -p "Continue anyway? [y/N] " -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]] || exit 1
fi

# 2. Build frontend (dual)
echo ""
echo "-> Building frontend..."
node build.js
echo ""

# 3. Syntax check backend
echo "-> Checking Python syntax..."
PYFILES="api.py config.py f1_data.py database.py f1_live.py settle_predictions.py bot.py"
for f in $PYFILES; do
    python3 -c "import ast,sys; ast.parse(open(sys.argv[1], encoding='utf-8').read())" "$f" && echo "  OK $f" || { echo "  FAIL $f"; exit 1; }
done
echo ""

# 4. Restart API (bind-mounts pick up changes, no docker cp needed)
echo "-> Restarting f1hub-api..."
docker restart f1hub-api
sleep 3

# 5. Health check
echo "-> Health check..."
for i in 1 2 3 4 5; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8002/api/health 2>/dev/null || echo "000")
    if [[ "$STATUS" == "200" ]]; then
        echo "  OK API healthy"
        break
    fi
    if [[ $i -eq 5 ]]; then
        echo "  FAIL API not healthy after 5 attempts!"
        docker logs f1hub-api --tail 20
        exit 1
    fi
    sleep 2
done

# 6. Verify both frontends
echo "-> Verifying frontends..."
WA=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: f1.lead-seek.ru" http://localhost:8002/ 2>/dev/null)
PUB=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: f1hub.lead-seek.ru" http://localhost:8002/ 2>/dev/null)
echo "  webapp: $WA  public: $PUB"
[[ "$WA" == "200" && "$PUB" == "200" ]] || { echo "  FAIL Frontend check failed!"; exit 1; }

# 7. Show recent logs
echo ""
echo "-> Recent logs:"
docker logs f1hub-api --tail 5 2>&1 | grep -v "^$"

echo ""
echo "=== Deploy complete ==="
