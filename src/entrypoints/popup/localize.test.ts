import { describe, expect, it } from 'vitest';
import type { Translate } from '../../core/messages';
import { localizePage } from './localize';

const shout: Translate = (key) => key.toUpperCase();

describe('localizePage', () => {
  it('fills the text and the attributes a page names, and only those', () => {
    document.body.innerHTML =
      '<h1 data-i18n="details">old</h1>' +
      '<textarea data-i18n-placeholder="topicsLabel"></textarea>' +
      '<a data-i18n-title="githubLabel" data-i18n-aria-label="githubLabel">uFeed</a>' +
      '<p>untouched</p>';

    localizePage(document, shout);

    expect(document.querySelector('h1')!.textContent).toBe('DETAILS');
    expect(document.querySelector('textarea')!.placeholder).toBe('TOPICSLABEL');
    const link = document.querySelector('a')!;
    expect(link.title).toBe('GITHUBLABEL');
    expect(link.getAttribute('aria-label')).toBe('GITHUBLABEL');
    expect(link.textContent).toBe('uFeed');
    expect(document.querySelector('p')!.textContent).toBe('untouched');
  });
});
