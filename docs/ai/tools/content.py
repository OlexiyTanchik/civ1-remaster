"""Додавання вмісту (енуми, юніти, споруди, технології, застарівання, черга AI, панорама, спрайти) скриптом-пакетом:
    import sys; sys.path.insert(0, "docs/ai/tools"); from content import *  — запускати з кореня репозиторію.
Рядки описів — звичайний текст (апострофи екрануються самі)."""
import json, re

def _rw(p, fn):
    s = open(p, encoding='utf-8').read()
    s2 = fn(s)
    assert s2 != s, p
    open(p, 'w', encoding='utf-8').write(s2)

def _insert_before_close(s, start_marker, text, close='\n}'):
    i = s.index(start_marker)
    j = s.index(close, i)
    return s[:j] + text + s[j:]

def sub(p, a, b, cnt=1):
    s = open(p, encoding='utf-8').read()
    assert s.count(a) == cnt, (p, a[:70], s.count(a))
    open(p, 'w', encoding='utf-8').write(s.replace(a, b))

def esc(t):
    return t.replace("\\", "\\\\").replace("'", "\\'")

def enum(name, comment, items):
    """items: [(EnumName, 'value')]"""
    text = f"\n  // {comment}\n" + "\n".join(f"  {e} = '{v}'," for e, v in items)
    _rw('src/core/types.ts', lambda s: _insert_before_close(s, f'export enum {name} {{', text))

def units(comment, items):
    """items: dict(e, name, ua, a, d, m, cost, domain='land', pre, desc, extra='')"""
    body = f"  // {comment}\n" + "".join(
        f"  [UnitTypeKey.{u['e']}]: {{\n    key: UnitTypeKey.{u['e']}, name: '{esc(u['name'])}', nameUa: '{esc(u['ua'])}', attack: {u['a']}, defense: {u['d']}, moves: {u['m']}, cost: {u['cost']}, domain: '{u.get('domain','land')}',{(' ' + u['extra']) if u.get('extra') else ''}\n    prereqTech: '{u['pre']}', descriptionUa: '{esc(u['desc'])}',\n  }},\n" for u in items)
    _rw('src/core/constants.ts', lambda s: s.replace("};\n\n/** Юніт для цивілізації:", body + "};\n\n/** Юніт для цивілізації:", 1))

def buildings(comment, items):
    """items: dict(e, ua, cost, m, pre, desc, extra='')"""
    body = f"  // {comment}\n" + "".join(
        f"  [BuildingTypeKey.{b['e']}]: {{\n    key: BuildingTypeKey.{b['e']}, nameUa: '{esc(b['ua'])}', cost: {b['cost']}, maintenance: {b['m']}, prereqTech: '{b['pre']}',{(' ' + b['extra']) if b.get('extra') else ''}\n    descriptionUa: '{esc(b['desc'])}',\n  }},\n" for b in items)
    def f(s):
        i = s.index('export const BUILDING_CONFIGS')
        j = s.index('\n};\n', i)
        return s[:j + 1] + body + s[j + 1:]
    _rw('src/core/constants.ts', f)

def techs(comment, items):
    """items: (id, ua, era, [prereqs], desc)"""
    body = f"  // {comment}\n" + "".join(
        f"  {t[0]}: {{ id: '{t[0]}', nameUa: '{esc(t[1])}', era: {t[2]}, prereqs: [{', '.join(repr(p) for p in t[3])}], descriptionUa: '{esc(t[4])}' }},\n" for t in items)
    def f(s):
        i = s.index('export const TECH_TREE')
        j = s.index('\n};\n', i)
        return s[:j + 1] + body + s[j + 1:]
    _rw('src/core/constants.ts', f)

def upgrades(pairs, replace=()):
    """pairs: [(From, To)] — нові записи; replace: [(From, NewTo)] — змінити наявні"""
    def f(s):
        for a, b in replace:
            s, n = re.subn(rf"  \[UnitTypeKey\.{a}\]: UnitTypeKey\.\w+,", f"  [UnitTypeKey.{a}]: UnitTypeKey.{b},", s)
            assert n == 1, a
        if pairs:
            i = s.index('const UPGRADES')
            j = s.index('\n};', i)
            s = s[:j] + "\n" + "\n".join(f"  [UnitTypeKey.{a}]: UnitTypeKey.{b}," for a, b in pairs) + s[j:]
        return s
    _rw('src/core/world.ts', f)

def research(after, new):
    """Вставити технології `new` у RESEARCH_ORDER після `after`."""
    _rw('src/core/ai.ts', lambda s: s.replace(f"'{after}',", f"'{after}', " + " ".join(f"'{t}'," for t in new), 1))

def slots(comment, items):
    """items: (Enum, x, y, scale)"""
    text = f"\n  // {comment}\n" + "\n".join(f"  [BuildingTypeKey.{e}]: {{ x: {x}, y: {y}, scale: {sc} }}," for e, x, y, sc in items)
    _rw('src/ui/city-panorama.ts', lambda s: _insert_before_close(s, 'const BUILDING_SLOTS', text, close='\n};'))

def sprites(items):
    """items: (id, kind, prompt)"""
    p = 'assets_src/sprites.json'
    j = json.load(open(p, encoding='utf-8'))
    lst = next(v for v in j.values() if isinstance(v, list) and any(isinstance(e, dict) and e.get('id') == 'u_militia' for e in v))
    have = {e.get('id') for e in lst if isinstance(e, dict)}
    for i, k, pr in items:
        assert i not in have, i
        lst.append({"id": i, "kind": k, "prompt": pr})
    open(p, 'w', encoding='utf-8').write(json.dumps(j, ensure_ascii=False, indent=2) + '\n')
