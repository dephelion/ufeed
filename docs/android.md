# Debugging on Firefox for Android

Loading a temporary build onto a phone isn't the same flow as desktop, for two
reasons that both bite before you get anywhere.

## Why this isn't the desktop flow

Release Firefox for Android only installs extensions from a curated AMO
collection — no sideloading, full stop. Testing an unpublished build needs
**Firefox Nightly** on the phone instead.

And even with Nightly, `about:debugging`'s remote-runtime page (desktop
connected to the phone over USB) is read-only — it lists what's already
loaded, but there's no _Load Temporary Add-on_ button on it. That button only
exists on local runtimes ("This Firefox"). Getting a build onto Android goes
through `web-ext run` instead, which drives the same underlying protocol over
adb.

## One-time setup

1. Install **Firefox Nightly** on the phone (not release Firefox) — and
   desktop Nightly too. Desktop and phone need to be on the same channel, or
   `about:debugging` warns of a version mismatch and DevTools features
   (including the extension list) can silently break.
2. On the phone, Android Developer Options: enable **USB debugging**, and set
   the USB connection mode to **File Transfer**, not charging-only.
3. On the phone, inside Nightly: Settings → search "remote" → enable **Remote
   debugging via USB**. Nightly has to be open in the foreground when you
   connect.
4. On desktop, install a standalone `adb` binary. `web-ext` shells out to a
   real executable — it can't reuse Firefox's own internal adb implementation.
   ```bash
   brew install android-platform-tools
   ```

## Loading the extension

```bash
adb devices                              # confirm the phone shows up
npx web-ext run \
  --source-dir=.output/firefox-mv3-debug \
  --target=firefox-android \
  --android-device=<id-from-adb-devices> \
  --firefox-apk=org.mozilla.fenix
```

`--source-dir` points at a build output, not `src/` — `web-ext` reloads when
that directory changes, not on a source edit. `npm run watch` rebuilds
`.output/firefox-mv3-debug` on save, so point `--source-dir` there and it
picks changes up on its own. For a production build, run `npm run build:firefox`
(or `npm run build`, which covers both browsers) and use `.output/firefox-mv3`.
