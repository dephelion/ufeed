# Lensing v5 — Export & Import Configuration

> **Status: APPROVED, not yet built.** A plan, not a record. Numbers here are
> measured; everything else is a decision or a leaning, and `specs/` is
> provenance rather than authority — the source of truth is
> [`wiki-llm/`](../wiki-llm/index.md).
>
> **Three questions were settled before implementation started.** The UI stays in
> the popup (§5), so the manifest does not change and no new permission is asked
> (§6). The model id is stamped into the file, for the release that ships a
> second model (§3). The stale-`Tuning` bug is fixed inside this spec rather than
> deferred (§9).

---

## 1. Problem

Everything a reader tunes lives in one browser profile's `storage.local`. There
is no way to move it to a second device and no way to back it up: a profile
reset, a reinstall, or one accidental "Remove extension" takes it with it.

Topics are cheap to retype. **Corrections are not.** Each one is a post the
reader found, judged, and thumbed — up to 50 per class per topic line, built up
over hours of real feed use, and unreproducible because the posts that produced
them have scrolled away.

Goal: one file out, the same file back in, on another device or after a
reinstall.

## 2. What crosses the file

The extension persists exactly two `storage.local` keys. The export is those two
keys plus a header; there is no third thing to go looking for.

| Data                                                    | In the file? | Why                                                                |
| :------------------------------------------------------ | :----------- | :----------------------------------------------------------------- |
| `settings` (all of [Settings](../src/core/settings.ts)) | Yes          | Topics, strictness, overrides, per-host toggles. The whole object. |
| `feedback.byTopic` (Rating vectors)                     | Yes          | The expensive half. The reason this spec exists.                   |
| Score cache                                             | No           | In-memory, session-scoped, cleared on reload.                      |
| Engine status                                           | No           | Deliberately never stored ([privacy.md](../wiki-llm/privacy.md)).  |
| Model weights                                           | No           | Browser HTTP cache. Re-downloaded once on the new device.          |

## 3. Format

One JSON object: a header a human can read, then the two payloads.

| Field        | Purpose                                                                     |
| :----------- | :-------------------------------------------------------------------------- |
| `schema`     | Integer, starts at `1`. A higher number than the importer knows is refused. |
| `app`        | Extension version that wrote the file. Diagnostic only, never gates import. |
| `exportedAt` | ISO date. So a reader with three backups can tell them apart.               |
| `model`      | `{ id, dim }` — `Xenova/e5-small-v2`, 384.                                  |
| `settings`   | Plain JSON. The part a privacy-minded reader can actually audit.            |
| `feedback`   | Per topic line, ratings as `{ key, liked, vector }` with `vector` base64.   |

**Decided: stamp the model id, and stamp it now.** Nothing in `storage.local`
today records which model produced a vector, because only one model has ever
shipped. An export is the first artifact that outlives the install that wrote
it, so it is the first place the omission can hurt: a vector from another model
dropped into a Rocchio update poisons the topic centroid silently, with no error
and no visible symptom beyond a feed that gradually stops making sense.

The stamp is written for the version after next. A new model version, or a
second model shipping alongside e5-small-v2, makes every stored vector
model-specific — and by then the files are already in readers' hands. `model.id`
plus `dim` in the header is what lets that release read an old backup and know
what to do with it: refuse the feedback half, or, once there is more than one
model, re-embed from nothing rather than mix scales. Cheap now, unavailable
later.

## 4. Size, and how vectors are encoded

Measured on 384-dimension float32 vectors with embedding-like magnitudes:

| Encoding               | Per vector | One topic, both classes full (100) | Five such topics |
| :--------------------- | ---------: | ---------------------------------: | ---------------: |
| Raw JSON number array  |     8118 B |                             793 KB |          3.87 MB |
| JSON rounded to 4 dp   |     2851 B |                             278 KB |          1.36 MB |
| **base64 float32**     | **2048 B** |                         **200 KB** |      **0.98 MB** |
| base64 int8, quantized |      512 B |                              50 KB |          0.24 MB |

**Recommend base64 float32**, written with `DataView.setFloat32(…, true)` rather
than a raw `Float32Array` byte view — explicit little-endian, so the file does
not depend on the host that wrote it.

**Quantization rejected.** Another 4x, paid for in precision, in exactly the
vectors the feature exists to preserve, to save under a megabyte. There is no
size problem here to solve: 1 MB is a rounding error against the ~22.5 MB the
package already carries, and sits well under Chrome's 10 MB `storage.local`
quota on the way back in.

## 5. Where the UI lives — decided: the popup

**Decided: the popup, not a new page.** No `options_ui`, no second surface to
style, no second place a reader has to find. The cost is that both halves of the
feature run against the popup lifecycle, and neither is guaranteed:

1. **`<input type="file">` from a popup can lose the event.** The OS picker takes
   focus, the browser may close the popup, the page is destroyed, and `change`
   fires into nothing.
2. **`<a download>` from a popup can lose the download**, the same way: focus
   loss tears the page down and revokes the blob URL under it.

Both are per-browser, per-platform behaviours, not settled facts. **Test them
before writing the UI** (§10, step 1) — twenty minutes on Chrome and Firefox,
macOS, with a throwaway button. What the test decides is not the surface, it is
whether a fallback ships:

| Result           | What ships                                                                    |
| :--------------- | :---------------------------------------------------------------------------- |
| Both survive     | File input and anchor download. Nothing else.                                 |
| One or both fail | That half falls back to a textarea: select-and-copy out, paste-and-import in. |

The textarea fallback needs no browser cooperation at all — no picker, no
download, no focus to lose — which is exactly why it is the fallback rather than
the default: at §4 sizes a full backup is ~1 MB of base64, fine to paste and
ugly to look at. Do not build it pre-emptively.

**Where it goes in the popup.** [ui.md](../wiki-llm/ui.md) records that the popup
already runs past Chrome's 600px cap, so this cannot be a new titled section. One
compact row of two buttons — Export, Import — beside Reset in Advanced, where the
other whole-configuration actions already live. Keep the hint to a single line
(§7).

## 6. Permissions and manifest

**No new permission, on the recommended design.** Neither half of this feature
needs one.

| Capability            | API                                    | Permission                    |
| :-------------------- | :------------------------------------- | :---------------------------- |
| Write the file        | `<a download>` + `URL.createObjectURL` | **None**                      |
| Read the file back    | `<input type="file">` + `File.text()`  | **None**                      |
| Read/write the config | `storage.local`                        | `storage`, already held       |
| A page in a tab       | `options_ui` manifest key              | **None** — a key, not a grant |

The manifest gains `options_ui` and nothing else. That is a key, not a
permission: no install warning, **no re-consent prompt for existing users**
(Chrome only re-prompts when a change adds a permission warning), and no new
justification line in the store dashboard.

**The one way to get this wrong** is `browser.downloads.download()`. It needs the
`downloads` permission, which Chrome surfaces at install as "Manage your
downloads" and which disables the extension for existing users until they accept
it — a real warning, paid for a file save an anchor already does. Rejected.

Also rejected: `clipboardRead` (a textarea the reader pastes into needs none),
`clipboardWrite` (only if a copy-to-clipboard fallback ships, and only Firefox
wants it), `unlimitedStorage` (§4: nowhere near the quota).

**Store impact is one line of listing copy.** The data-safety answers do not
move: still no collection, still no transmission, still no analytics. Because the
manifest is untouched, an existing install updates silently, the way any other
release does.

## 7. Privacy

[privacy.md](../wiki-llm/privacy.md) says corrections are "local only, never
synced, never transmitted". **Export does not break that** — the extension still
transmits nothing, and the only transport is the reader's own click. But it does
hand them a file they may well drop into a synced folder, and that file contains
embeddings of posts they read.

The wiki already states plainly that an embedding is partially invertible and
not the same as storing nothing. The export must inherit that honesty rather
than quietly imply a backup is anonymous:

- One sentence beside the button: the file contains embeddings of the posts you
  rated; keep it as you would keep any personal file.
- The same sentence, once, in [privacy.md](../wiki-llm/privacy.md) and
  [`docs/privacy-policy.md`](../docs/privacy-policy.md).
- **No automatic export, no scheduled backup, no cloud destination, ever.** The
  moment a file leaves on any schedule but a click, the privacy claim changes
  shape.

`storage.sync` was the other way to solve this problem and is worse on both
counts: 100 KB total and 8 KB per item cannot hold a single topic's vectors
(§4), and it would ship the reader's topics to a browser vendor's server —
turning a no-backend extension into one with a backend nobody chose.

## 8. Import semantics

**Replace, not merge.** Merge has to answer who wins on a shared topic line, how
the per-class cap resolves across two histories, and what a `key` collision
means; every answer is arbitrary and none is inspectable afterwards. Replace is
predictable and it is what "restore my backup" means.

**Confirm with counts before writing anything**: _"Import 3 topics and 128
ratings, replacing your 1 topic and 12 ratings?"_ Both sides of the trade, in
the numbers the reader recognises from the popup's tuning stats.

**Validate by reuse, not by new code.** Two normalizers already exist and both
already survive hostile input:

- [`withDefaults()`](../src/core/settings.ts) repairs a settings object and has
  already outlived one scale change on `strictness`.
- [`normalizeFeedback()`](../src/core/feedback.ts) drops anything that is not a
  `Rating` rather than trusting it.

An import file is untrusted input in exactly the way stored JSON from an older
build is untrusted input. Run it through both. Write only the checks they cannot
make:

| Check                             | On failure                                                                                                          |
| :-------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| `schema` newer than known         | Refuse the whole file. Name the version.                                                                            |
| `model.id` / `dim` mismatch       | Refuse the feedback half, import settings, say which and why.                                                       |
| Ratings over `MAX_PER_CLASS`      | Trim oldest-first, as `append()` does.                                                                              |
| Topic lines with no settings line | Drop, via [`forTopics()`](../src/core/feedback.ts) — the same rule the popup already applies when a line is edited. |

**A bad file changes nothing.** Parse, validate and build the next state in full
before the first `storage.local.set`.

## 9. Blocker, fixed in this spec: an open feed tab holds feedback in memory

[`Tuning`](../src/feed/tuning.ts) loads feedback once, at content-script start,
and never re-reads it. Nothing listens for feedback changes the way
[`onSettingsChanged`](../src/core/settings-storage.ts) listens for settings. So
with a feed tab open, an import is invisible to that tab — and the next thumb
calls `saveFeedback` with the stale in-memory copy, overwriting everything that
was just imported.

**This is not new to import.** "Clear tuning" and Reset have the same hole
today: clear while a feed tab is open, thumb one post, and everything cleared
comes back.

**Decided: fixed here, not deferred.** An `onFeedbackChanged` in
`feedback-storage.ts` mirroring the settings listener, and `Tuning` adopting the
value it delivers. It is a prerequisite for import and a bug fix on its own
merits, and it lands as its own step (§10, step 2) so the fix is reviewable
without the feature wrapped around it. The cheaper-looking alternative — telling
the reader to reload their tabs — ships the same defect with instructions
attached.

Worth one assertion, by the [AGENTS.md](../AGENTS.md) test rule: **an import that
lands is not overwritten by an open tab.** That is a decision, not a rendering.

## 10. Task order

1. **Popup viability check (§5).** Twenty minutes, Chrome and Firefox: does a
   file input keep its `change` event, and does an anchor download complete?
   Decides whether step 4 needs the textarea fallback.
2. **`onFeedbackChanged` + `Tuning` adoption + its test (§9).** Its own commit:
   standalone, independently valuable, fixes "Clear tuning" and Reset today.
3. **`src/core/config-transfer.ts`** — pure. `exportConfig(settings, feedback)`
   and `importConfig(unknown)` returning a result union, no `browser.*` inside.
   Tested for: round trip, float32 fidelity, junk file, truncated file, wrong
   schema, wrong model, cap overflow, orphan topic lines.
4. **Popup wiring**: one Export/Import row in Advanced beside Reset, the
   confirm from §8, the one-line hint from §7.
5. **Wiki, same commit as step 4**: [privacy.md](../wiki-llm/privacy.md) (§7),
   [ui.md](../wiki-llm/ui.md) (the new popup row and what it warns about),
   [architecture.md](../wiki-llm/architecture.md) (the two storage keys are now a
   documented file format, not an implementation detail).
   [manifest.md](../wiki-llm/manifest.md) is untouched — §6, and that is worth a
   line in the commit body rather than a wiki edit.
6. **Policy copy, all three places, or none.** They must never disagree:
   - [`docs/privacy-policy.md`](../docs/privacy-policy.md) — the export sentence
     from §7.
   - **`dephelion.com`**, the published policy at
     `src/app/lensing-browser-extension/privacy/page.tsx` — same sentence, beside
     the existing "Thumb ratings" and Clear-tuning paragraphs, plus
     `LENSING_POLICY_DATE` in `src/lib/lensing.ts` bumped in the same commit. It
     is a separate repo, so it is a separate commit that ships with the release,
     not after it: the extension must not offer an export the live policy does
     not describe.
   - The store dashboard paste, at submission — see the checklist in
     [privacy.md](../wiki-llm/privacy.md).

## 11. Open questions

| #   | Question                                                | Leaning                                                                                           |
| :-- | :------------------------------------------------------ | :------------------------------------------------------------------------------------------------ |
| Q1  | Filename                                                | `lensing-backup-YYYY-MM-DD.json`. Sorts, and says what it is in a downloads folder.               |
| Q2  | Merge mode, ever?                                       | Not until someone with two real devices asks for it. §8.                                          |
| Q3  | Export with nothing to export?                          | Disable the button at 0 topics and 0 ratings. An empty backup that looks like a backup is a trap. |
| Q4  | Same confirm weight as Reset?                           | Yes — import destroys strictly more than Reset does.                                              |
| Q8  | Does the popup survive a file picker and a download?    | **Open until step 1 runs.** The only open question that changes what gets built. §5.              |
| Q5  | Encrypt or password-protect the file?                   | No. The same vectors already sit in plaintext in the profile on the same disk.                    |
| Q6  | Import a file exporting hosts this build never matched? | Harmless — `disabledHosts` is an exclusion list; an unknown entry excludes nothing.               |
| Q7  | Version the format, or the app?                         | Both, but only `schema` gates. An old app must refuse a new file; a new app must read an old one. |
