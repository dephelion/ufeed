import { vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';

// The real polyfill throws outside an extension. A test file's own vi.mock still wins.
vi.mock('webextension-polyfill', () => ({ default: fakeBrowser }));
