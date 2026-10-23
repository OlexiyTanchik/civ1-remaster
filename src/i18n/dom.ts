/**
 * Переклад інтерфейсу на рівні DOM: текстові вузли й підказки `title` перекладаються за словником
 * і шаблонами, щойно з'являються на сторінці. Так англійською стає і HTML-рядки вікон, і повідомлення ядра,
 * не переписуючи кожен файл; чого нема в словнику — лишається українським (без порожніх місць).
 */
import { lang } from './index';
import { translateMessageEn } from './en-messages';

const CYR = /[А-Яа-яЇїІіЄєҐґ]/;

/** Переклад одного рядка: пробіли по краях зберігаються. */
export function translateString(s: string): string {
  if (!CYR.test(s)) return s;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s)!;
  const out = translateMessageEn(m[2]);
  return out === m[2] ? s : m[1] + out + m[3];
}

function translateNode(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const v = node.nodeValue;
    if (v && CYR.test(v)) {
      const tr = translateString(v);
      if (tr !== v) node.nodeValue = tr;
    }
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
  const title = el.getAttribute('title');
  if (title && CYR.test(title)) {
    const tr = translateString(title);
    if (tr !== title) el.setAttribute('title', tr);
  }
  for (let c = el.firstChild; c; c = c.nextSibling) translateNode(c);
}

/** Англійська: перекласти вже наявне й стежити за всім новим. */
export function startDomTranslation(): void {
  if (lang !== 'en') return;
  translateNode(document.body);
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData' || r.type === 'attributes') translateNode(r.target);
      else r.addedNodes.forEach(translateNode);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title'] });
}
