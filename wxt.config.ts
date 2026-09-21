import { defineConfig } from 'wxt';

const FEED_HOSTS = [
  '*://x.com/*',
  '*://twitter.com/*',
  '*://linkedin.com/*',
  '*://*.linkedin.com/*',
  '*://reddit.com/*',
  '*://*.reddit.com/*',
];

export default defineConfig({
  srcDir: 'src',
  // Debug is the CLI mode (`--mode debug`), never an env var: WXT loads `.env` into
  // process.env, and a store build must not log whatever that file says.
  vite: ({ mode }) => ({
    build: {
      minify: mode !== 'debug',
      sourcemap: mode === 'debug' ? 'inline' : false,
    },
  }),
  manifestVersion: 3,
  webExt: { disabled: true },
  // The AMO sources zip is for rebuilding the extension; design docs are not.
  zip: { excludeSources: ['wiki-llm/**', 'docs/**', 'AGENTS.md'] },
  manifest: ({ browser }) => ({
    name: 'FeedLens: Feed Cleaner for Social Networks',
    // Text lives in public/_locales; the browser picks the locale (wiki-llm/i18n.md).
    default_locale: 'en',
    description: '__MSG_extDescription__',
    permissions: ['storage'],
    host_permissions: FEED_HOSTS,
    /**
     * Grayscale by default: a tab with no feed, or one whose engine has not
     * started, never reports in (see background.ts), so the toolbar icon has
     * to start idle-looking rather than assume a feed is running.
     */
    action: {
      default_title: 'FeedLens',
      default_icon: {
        16: 'icon-gray/16.png',
        32: 'icon-gray/32.png',
        48: 'icon-gray/48.png',
        128: 'icon-gray/128.png',
      },
    },
    web_accessible_resources: [
      // icon-gray/48.png is the toolbar icon as it looks during the no-topics
      // state the nudge card appears in, so a new reader knows which (gray)
      // button to look for. An <img> in the page cannot load an extension file
      // that is not listed here.
      // icon/32.png is the posts-hidden badge's icon, for the same reason.
      // The catalogs let a feed tab read the language the reader picked in the popup.
      {
        resources: [
          'engine.html',
          'icon-gray/48.png',
          'icon/32.png',
          '_locales/*/messages.json',
        ],
        matches: FEED_HOSTS,
      },
    ],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    /**
     * Floor set by `color-mix()`, the newest thing the stylesheets use. Below it
     * the blur label and the no-topics card lose their backgrounds, which is a
     * broken-looking install rather than an honest refusal to run.
     */
    ...(browser === 'chrome' ? { minimum_chrome_version: '111' } : {}),
    /**
     * Firefox only. Chrome logs it as an unrecognized key, and a manifest a
     * reviewer has to explain away is a manifest worth trimming.
     */
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'feedlens@dephelion.com',
              strict_min_version: '115.0',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
});
