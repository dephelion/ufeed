/**
 * Single source of truth for debug mode. On: console logs from every layer and
 * a score badge on every post. Off in `npm run build`, so no release ships them.
 * Turn on with `npm run watch` or `npm run build:debug`.
 */
export const DEBUG =
  import.meta.env.DEV || import.meta.env.VITE_LENSING_DEBUG === '1';
