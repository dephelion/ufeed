/**
 * Single source of truth for debug mode: console logs from every layer. Only
 * `--mode debug` turns it on (`npm run watch`, `npm run build:debug`); no env var
 * or `.env` file can, so every other build, store zips included, never logs.
 */
export const DEBUG = import.meta.env.MODE === 'debug';
