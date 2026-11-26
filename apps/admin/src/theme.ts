import { cssVariables, themes } from '@kidzo/ui-tokens';

/** Writes the design tokens as CSS custom properties. The only source of admin colors. */
export function installTokens(): void {
  const id = 'kidzo-tokens';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = cssVariables(themes.admin);
  document.head.prepend(style);
}
