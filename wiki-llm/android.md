# Debugging on Firefox for Android

> **Maintenance Invariant:** Steps and commands only. Update in the SAME commit as any change to the loading path or required channel/tooling.
> **Answers:** How to get a temporary build of the extension running on a phone.

## Why this isn't the desktop flow

Release Firefox for Android only installs extensions from a curated AMO
collection — no sideloading. Testing an unpublished build needs **Firefox
Nightly** on the phone.

`about:debugging`'s remote-runtime page (desktop connected to the phone over
USB) is read-only: it lists what's already loaded, it has no _Load Temporary
Add-on_ button. That button exists only on local runtimes ("This Firefox").
Loading onto Android goes through `web-ext run` instead, which drives the same
protocol over adb.

## One-time setup

1. Install **Firefox Nightly** on the phone (not release Firefox) and desktop
   Nightly too — desktop and phone must be on the same channel, or
   `about:debugging` warns of a version mismatch and DevTools features go
   missing.
2. Phone, Android Developer Options: enable **USB debugging**, and set the USB
   connection mode to **File Transfer**, not charging-only.
3. Phone, inside Nightly: Settings → search "remote" → enable **Remote
   debugging via USB**. Nightly must be open in the foreground when connecting.
4. Desktop: install a standalone `adb` binary — `web-ext` shells out to a real
   executable, it can't reuse Firefox's internal implementation.
   ```bash
   brew install android-platform-tools
   ```

## Loading the extension

```bash
adb devices                              # confirm the phone shows up
npx web-ext run \
  --source-dir=.output/firefox-mv3 \
  --target=firefox-android \
  --android-device=<id-from-adb-devices> \
  --firefox-apk=org.mozilla.fenix
```

`--source-dir` is a build output, not `src/` — `web-ext` reloads on changes to
that directory, not on a source edit. Rebuild before it'll pick anything up:
`npm run build:firefox` (or `npm run build`, which now covers both browsers).
Nothing currently watches and rebuilds `.output/firefox-mv3` on save; that's a
gap in `scripts/watch-build.mjs`, not in this flow.
