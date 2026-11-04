#!/bin/sh
# Serverda ishga tushiriladi: nginx orqali, 127.0.0.1 dan (IP chegarasidan ozod), bosqichma-bosqich.
# Xato 5% dan oshsa keyingi bosqichga o'tilmaydi. Yuklama generatori ham shu serverda: natija ehtiyotkor.
#   sh run-steps.sh /path/to/viewers.mjs "200 500 1000 2000" 75
SCRIPT=${1:-/opt/uztt/tools/load-test/viewers.mjs}
STEPS=${2:-"200 500 1000 2000"}
SEC=${3:-75}
for n in $STEPS; do
  tvs=$((n / 20))
  docker run --rm --network host --add-host stoltennis.uz:127.0.0.1 --ulimit nofile=65535:65535 -v "$SCRIPT":/v.mjs:ro node:22-alpine \
    node /v.mjs https://stoltennis.uz "$n" "$SEC" "$tvs" > /tmp/lt.json 2>&1 &
  gen=$!
  maxload=0; maxcpu=0; minfree=999999; maxapi=0; maxweb=0
  while kill -0 $gen 2>/dev/null; do
    l=$(cut -d' ' -f1 /proc/loadavg)
    f=$(free -m | awk 'NR==2{print $7}')
    s=$(docker stats --no-stream --format '{{.Name}} {{.CPUPerc}}' 2>/dev/null)
    a=$(echo "$s" | awk '/api-1/{gsub("%","",$2);print int($2)}')
    w=$(echo "$s" | awk '/web-1/{gsub("%","",$2);print int($2)}')
    [ "${a:-0}" -gt "$maxapi" ] && maxapi=$a
    [ "${w:-0}" -gt "$maxweb" ] && maxweb=$w
    [ "$f" -lt "$minfree" ] && minfree=$f
    maxload=$(awk -v a="$maxload" -v b="$l" 'BEGIN{print (b>a)?b:a}')
    sleep 3
  done
  echo "=== $n tomoshabin, $tvs TV: load_max=$maxload bosh_ram_min=${minfree}MB api_cpu_max=${maxapi}% web_cpu_max=${maxweb}%"
  tail -1 /tmp/lt.json | cut -c1-700
  e=$(tail -1 /tmp/lt.json | sed -E 's/.*"errorPct":([0-9.]+).*/\1/')
  stop=$(awk -v e="${e:-100}" 'BEGIN{print (e>5)?1:0}')
  if [ "$stop" = 1 ]; then echo "TO'XTADI: xato ${e}%"; break; fi
  sleep 15
done
rm -f /tmp/lt.json
echo TUGADI
