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
  manifest: {
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
    browser_specific_settings: {
      gecko: { id: 'lensing@juliomatcom.dev', strict_min_version: '115.0' },
    },
  },
});
