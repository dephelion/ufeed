import { defineConfig } from 'wxt';

const FEED_HOSTS = [
  '*://x.com/*',
  '*://twitter.com/*',
  '*://linkedin.com/*',
  '*://*.linkedin.com/*',
  '*://reddit.com/*',
  '*://*.reddit.com/*',
];

/** Same flag that turns on logging; a build you read is a build you can debug. */
const DEBUG = process.env.VITE_LENSING_DEBUG === '1';

export default defineConfig({
  srcDir: 'src',
  vite: () => ({
    build: {
      // Production shape is what makes `npm run watch` usable for the worker,
      // but minified output turns every stack trace into `content.js:1`.
      minify: !DEBUG,
      sourcemap: DEBUG ? 'inline' : false,
    },
  }),
  manifestVersion: 3,
  webExt: { disabled: true },
  manifest: ({ browser }) => ({
    name: 'Lensing',
    description: 'Blur what you did not come here to read. Runs entirely on your device.',
    permissions: ['storage'],
    host_permissions: FEED_HOSTS,
    web_accessible_resources: [
      // icon/48.png is the toolbar icon, shown by the no-topics card so a new
      // reader knows which button to look for. An <img> in the page cannot load
      // an extension file that is not listed here.
      { resources: ['engine.html', 'icon/48.png'], matches: FEED_HOSTS },
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
            gecko: { id: 'lensing@juliomatcom.dev', strict_min_version: '115.0' },
          },
        }
      : {}),
  }),
});
