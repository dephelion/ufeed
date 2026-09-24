import browser from 'webextension-polyfill';
import { logger } from '../core/log';

const log = logger('welcome');
const WELCOME_URL = 'https://ufeed.es/welcome/';

export function openWelcomeOnInstall(reason: string): void {
  if (reason !== 'install') return;

  void browser.tabs.create({ url: WELCOME_URL }).catch((error: unknown) => {
    log.warn('welcome page did not open', {
      reason: error instanceof Error ? error.message : String(error),
    });
  });
}
