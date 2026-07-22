#!/usr/bin/env bash

set -Eeuo pipefail

cd /var/data/incident-web

echo "=== Before cleanup ==="
docker system df

echo
echo "=== Clear BuildKit cache ==="
docker builder prune -af

echo
echo "=== Clear unused images ==="
docker image prune -af

echo
echo "=== Clear stopped containers ==="
docker container prune -f

echo
echo "=== Clear unused networks ==="
docker network prune -f

echo
echo "=== After cleanup ==="
docker system df

echo
echo "เสร็จแล้ว ระบบที่กำลังรันอยู่ไม่ได้ถูกหยุด"
