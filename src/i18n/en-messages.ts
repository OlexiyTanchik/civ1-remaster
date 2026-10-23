/**
 * Переклад рядка англійською за словником EN_UI: спершу точний збіг, потім шаблони з {0}, {1}….
 * Частини, підставлені в шаблон (назви, числа, вкладені фрази), перекладаються тим самим способом —
 * так «🚀 … прибуття 2050 н.е.» стає «… arrival 2050 AD». Ядро (`src/core`) пише українською й не змінюється.
 */
import { EN_UI } from './en-ui';

const CYR = /[А-Яа-яЇїІіЄєҐґ]/;

interface Template {
  re: RegExp;
  /** Номер плейсхолдера для кожної групи регулярного виразу */
  order: number[];
  en: string;
}

let templates: Template[] | undefined;
/** HUD перемальовується щодії — однакові рядки не ганяємо крізь сотні шаблонів знову */
const cache = new Map<string, string>();

function compile(): Template[] {
  const list: { t: Template; weight: number }[] = [];
  for (const [uk, en] of Object.entries(EN_UI)) {
    if (!/\{\d+\}/.test(uk)) continue;
    const order: number[] = [];
    const src = uk.split(/(\{\d+\})/).map((part) => {
      const m = /^\{(\d+)\}$/.exec(part);
      if (m) {
        order.push(Number(m[1]));
        return '([\\s\\S]*?)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('');
    // Специфічніші шаблони (більше сталого тексту) — першими
    list.push({ t: { re: new RegExp(`^${src}$`), order, en }, weight: uk.replace(/\{\d+\}/g, '').length });
  }
  return list.sort((a, b) => b.weight - a.weight).map((x) => x.t);
}

export function translateMessageEn(text: string, depth = 0): string {
  if (!CYR.test(text)) return text;
  // Пробіли по краях (частини шаблонів часто з ними) — зберігаємо, перекладаємо серцевину
  const edge = /^(\s+)([\s\S]*?)(\s*)$|^([\s\S]*?)(\s+)$/.exec(text);
  if (edge) {
    const [lead, core, trail] = edge[1] !== undefined ? [edge[1], edge[2], edge[3]] : ['', edge[4], edge[5]];
    return lead + translateMessageEn(core, depth) + trail;
  }
  const exact = EN_UI[text];
  if (exact !== undefined) return exact;
  if (depth > 4) return text;
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const out = matchTemplate(text, depth);
  if (cache.size > 3000) cache.clear();
  cache.set(text, out);
  return out;
}

function matchTemplate(text: string, depth: number): string {
  templates ??= compile();
  for (const { re, order, en } of templates) {
    const m = re.exec(text);
    if (!m) continue;
    const values: Record<number, string> = {};
    order.forEach((ph, i) => { values[ph] = translateMessageEn(m[i + 1], depth + 1); });
    return en.replace(/\{(\d+)\}/g, (_, n) => values[Number(n)] ?? '');
  }
  return text;
}
