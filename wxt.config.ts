import { defineConfig } from 'wxt';

const FEED_HOSTS = ['*://x.com/*', '*://twitter.com/*'];
const OPTIONAL_HOSTS = ['*://reddit.com/*', '*://*.reddit.com/*'];

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  webExt: { disabled: true },
  manifest: {
    name: 'Lensing',
    description: 'Blur what you did not come here to read. Runs entirely on your device.',
    permissions: ['storage'],
    host_permissions: FEED_HOSTS,
    optional_host_permissions: OPTIONAL_HOSTS,
    web_accessible_resources: [
      { resources: ['engine.html'], matches: [...FEED_HOSTS, ...OPTIONAL_HOSTS] },
    ],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    browser_specific_settings: {
      gecko: { id: 'lensing@juliomatcom.dev', strict_min_version: '115.0' },
    },
  },
});
