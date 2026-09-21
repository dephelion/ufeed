import type { MessageKey, Translate } from '../../core/messages';

const ATTRIBUTES = ['placeholder', 'title', 'aria-label'] as const;

/**
 * Chrome localises only the manifest and stylesheets, never HTML. So the page
 * carries keys: `data-i18n` fills an element's text, `data-i18n-<attribute>` fills
 * that attribute. A locale test checks every key named here exists.
 */
export function localizePage(root: ParentNode, t: Translate): void {
  for (const node of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    node.textContent = t(node.dataset['i18n'] as MessageKey);
  }
  for (const attribute of ATTRIBUTES) {
    const marker = `data-i18n-${attribute}`;
    for (const node of root.querySelectorAll(`[${marker}]`)) {
      node.setAttribute(attribute, t(node.getAttribute(marker) as MessageKey));
    }
  }
}
