# Підсумок прогонів sim.mjs: python -I docs/ai/tools/sim-sum.py <файл із рядками JSON>
# Зведення прогонів: космос до 2100, загиблі, сума по WATCH
import sys, json, collections
rows = [json.loads(l) for l in open(sys.argv[1]) if l.startswith('{')]
space = sum(1 for r in rows if r['over'].startswith('space')); dead = sum(r['dead'] for r in rows)
tot = collections.Counter(); seen = collections.Counter()
for r in rows:
    for k, v in r.get('made', {}).items(): tot[k] += v; seen[k] += 1
print(f"світів {len(rows)}: космос до 2100 — {space}, загиблих {dead}; роки: {sorted(r['over'] for r in rows)}")
print(' '.join(f"{k}={tot[k]}({seen[k]})" for k in sorted(tot)))
