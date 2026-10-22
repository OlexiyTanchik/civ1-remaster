# Панорама міста з УСІМА спорудами без браузера: чи не ховається нова споруда за іншою.
# python -I docs/ai/tools/pano.py [КлючBuildingTypeKey …] → pano.png поруч (ключі з аргументів — у червоній рамці).
import re, json, sys
from PIL import Image
src = open("src/ui/city-panorama.ts", encoding="utf-8").read()
cfg = open("src/core/types.ts", encoding="utf-8").read()
keys = dict(re.findall(r"^\s+(\w+) = '(\w+)',", cfg, re.M))
consts = open("src/core/constants.ts", encoding="utf-8").read()
wonders = set(re.findall(r"BuildingTypeKey\.(\w+), nameUa: '[^']*', cost: \d+, maintenance: \d+(?:, prereqTech: '\w+')?(?:, requires: [\w.]+)?, isWonder", consts))
slots = re.findall(r"\[BuildingTypeKey\.(\w+)\]: \{ x: (\d+), y: (\d+), scale: ([\d.]+) \}", src)
a = Image.open("public/assets/sprites/atlas.png")
j = json.load(open("public/assets/sprites/atlas.json"))
fr = j.get("frames", j)
def rect(k):
    f = fr[k]; f = f.get("frame", f); return f
bd = rect("bd_land")
out = a.crop((bd["x"], bd["y"], bd["x"] + bd["w"], bd["y"] + bd["h"])).resize((384, 216), Image.NEAREST)
items = []
new = set(sys.argv[1:])
for name, x, y, s in slots:
    k = keys[name]
    frame = ("w_" if name in wonders else "b_") + k
    if frame not in fr: continue
    items.append((int(y), int(x), float(s) * 0.78, frame, name in new))
items.sort()
boxes = []
for y, x, s, frame, isnew in items:
    f = rect(frame)
    im = a.crop((f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]))
    w, h = max(1, round(f["w"] * s)), max(1, round(f["h"] * s))
    im = im.resize((w, h), Image.NEAREST)
    out.paste(im, (x - w // 2, y - h), im)
    if isnew: boxes.append((x - w // 2, y - h, x + w // 2, y))
from PIL import ImageDraw
d = ImageDraw.Draw(out)
for b in boxes: d.rectangle(b, outline=(255, 0, 0))
out.resize((384 * 3, 216 * 3), Image.NEAREST).save(sys.argv[0].replace("pano.py", "pano.png"))
print(len(items))
