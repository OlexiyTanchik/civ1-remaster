/**
 * Повідомлення ядра гри англійською: шаблони за регулярними виразами.
 * Ядро (`src/core`) пише українською й не змінюється; невідомі повідомлення лишаються як є.
 */
const RULES: [RegExp, string][] = [
];

export function translateMessageEn(text: string): string {
  for (const [re, en] of RULES) {
    if (re.test(text)) return text.replace(re, en);
  }
  return text;
}
