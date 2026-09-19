/**
 * Single source of truth for debug mode: console logs from every layer. Off in
 * `npm run build`, so no release ships them. Turn on with `npm run watch` or
 * `npm run build:debug`. The score badge is a setting, not a build flag.
 */
export const DEBUG = import.meta.env.DEV || import.meta.env.VITE_FEEDLENS_DEBUG === '1';
