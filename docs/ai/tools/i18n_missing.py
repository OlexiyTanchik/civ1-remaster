"""
Українські рядки коду без англійського перекладу в src/i18n/en-ui.ts.
  python -I docs/ai/tools/i18n_missing.py
Шаблонні рядки (з ${...}) показуються з {0}, {1}… — так їх і додавати в en-ui.ts.
Назви сутностей (юніти, споруди, технології…) перекладаються окремо — src/i18n/en-entities.ts.
"""
import os
import re, sys, json, glob
CYR = re.compile('[А-Яа-яЇїІіЄєҐґ]')
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'src') + '/'
files = sorted(glob.glob(R + 'ui/*.ts')) + [R + 'main.ts'] + \
  [f for f in sorted(glob.glob(R + 'core/*.ts')) if not f.endswith('constants.ts')] + \
  sorted(glob.glob(R + 'render/*.ts'))

def literals(src):
    """Літерали верхнього рівня: (лапка, вміст, [вирази ${} для шаблонів])."""
    i = 0; res = []
    while i < len(src):
        ch = src[i]
        if ch in '\'"`':
            j = i + 1; exprs = []
            while j < len(src):
                c = src[j]
                if c == '\\': j += 2; continue
                if ch == '`' and src.startswith('${', j):
                    k = j + 2; depth = 1
                    while k < len(src) and depth:
                        if src[k] in '\'"`':  # пропустити вкладений літерал цілком
                            q = src[k]; k += 1
                            d2 = 0
                            while k < len(src):
                                if src[k] == '\\': k += 2; continue
                                if q == '`' and src.startswith('${', k): d2 += 1; k += 2; continue
                                if q == '`' and d2 and src[k] == '}': d2 -= 1; k += 1; continue
                                if src[k] == q and not d2: break
                                k += 1
                            k += 1; continue
                        if src[k] == '{': depth += 1
                        elif src[k] == '}': depth -= 1
                        k += 1
                    exprs.append(src[j+2:k-1]); j = k; continue
                if c == ch: break
                if c == '\n' and ch != '`': break
                j += 1
            res.append((ch, src[i+1:j], exprs)); i = j + 1
        else:
            i += 1
    return res

segs = {}
def add(seg, where):
    seg = seg.strip()
    if CYR.search(seg): segs.setdefault(seg, where)

def process(ch, body, exprs, where):
    # вирази → {n}; вкладені літерали — окремо
    n = 0
    def rep(m):
        nonlocal n
        s = '{%d}' % n; n += 1; return s
    flat = re.sub(r'\$\{', '\x00', body)
    # заміна ${...} по порядку на {n}
    out = ''; k = 0; idx = 0
    while k < len(body):
        if body.startswith('${', k):
            # знайти кінець за довжиною виразу exprs[idx]
            e = exprs[idx]; out += '{%d}' % idx; k += 2 + len(e) + 1; idx += 1
        else:
            out += body[k]; k += 1
    for e in exprs:
        for (c2, b2, x2) in literals(e): process(c2, b2, x2, where)
    # title="..." з тегів
    for t in re.findall(r'title="([^"]*)"', out): add(t, where)
    # текст поза тегами
    for part in re.split(r'<[^>]*>', out): add(part, where)

for f in files:
    src = open(f, encoding='utf-8').read()
    src = re.sub(r'/\*[\s\S]*?\*/', '', src)
    src = re.sub(r'(^|[^:\'"`\\])//[^\n]*', r'\1', src)
    for (ch, body, exprs) in literals(src):
        if CYR.search(body) or any(CYR.search(e) for e in exprs): process(ch, body, exprs, f[len(R):])

en = open(R + 'i18n/en-ui.ts', encoding='utf-8').read()
keys = set(json.loads('[' + m + ']')[0] for m in re.findall(r'^  ("(?:[^"\\]|\\.)*"):', en, re.M))
skip = {'ui/sound-fx.ts', 'render/sprite-atlas.ts', 'ui/history.ts'}
missing = [k.replace("\\'", "'") for k, f in segs.items() if f not in skip and len(k) > 1 and k.replace("\\'", "'") not in keys]
for k in missing: print(segs.get(k, ''), '|', k)
print('без перекладу:', len(missing))
