# uFeed — Privacy Policy

> Source of record for the page published at
> <https://dephelion.com/ufeed-browser-extension/privacy/>. Edit both together.

**Effective 23 September 2026.** Contact: contact@dephelion.com

uFeed blurs posts in your social feed that are not about topics you chose. It
does this on your own device. This policy describes everything it reads, stores
and sends.

## Short version

uFeed does not collect your data. Nothing you read, type or rate is sent to us
or to anyone else. There are no accounts, no analytics, no trackers, and no
advertising. We cannot see what you read, what your topics are, or that you use
uFeed at all.

## What uFeed reads

On x.com, twitter.com, linkedin.com and reddit.com, uFeed reads the text of
posts in the page so it can compare them against your topics. This comparison
happens inside your browser.

Post text is held in memory for as long as it takes to score it, then discarded.
It is never written to disk, never sent over the network, and never written to a
log.

uFeed does not read any other page. On every other website it does nothing.

## What uFeed stores on your device

Stored in your browser's local extension storage. It stays on your device, is
not synced to other devices, and is never transmitted.

| What          | Details                                                                                                          |
| :------------ | :--------------------------------------------------------------------------------------------------------------- |
| Your settings | Topics, blocked keywords, strictness, which model you chose, your language, and the on/off toggles in the popup. |
| Thumb ratings | Only if you turn on "Learn from my thumbs", which is **off** unless you turn it on. See below.                   |

**About thumb ratings.** When that option is on and you rate a post, uFeed
stores a list of numbers describing that post's meaning (an "embedding"), a
one-way hash of its text, and whether you rated it up or down. It does not store
the post itself. We want to be precise rather than reassuring: an embedding is
derived from the post's content, and research has shown embeddings can be
partially reversed toward the original text. Treat it as a compact, lossy trace
of a post you rated, not as an anonymous number. It never leaves your device, at
most 50 up-ratings and 50 down-ratings are kept per topic line, and the oldest
fall off first. Each model keeps its own ratings: ones made with one model are
never read by the other, and they are kept when you switch.

**Exporting and importing.** The Backup row in the popup writes your settings
and your thumb ratings (for every model that has any) to a file you choose, and
reads one back. That file
contains the same embeddings described above, so treat it as personal: anyone
who opens it sees your topics, and holds a lossy trace of the posts you rated.
uFeed only ever writes that file when you click Export — there is no automatic
backup, no schedule, and nowhere for it to go but your own disk. Importing a
file replaces the settings and ratings already stored.

## What uFeed sends

**One kind of network request exists: downloading the language model.**

The first time uFeed needs to score a feed, it downloads the model that does
the comparison from Hugging Face at `huggingface.co`, which redirects the larger
files to its storage CDN at `hf.co`. That is about 33 MB for the default English
model. If you choose the multilingual model in the popup, it downloads that one
instead, about 197 MB, the first time you use it. Only the model you have chosen
is ever requested. Your browser then caches it, and later sessions use the cached
copy.

Be aware of what this request implies: like any file download, it tells Hugging
Face's servers your IP address and which file was requested, so which model you
chose. It carries none of your topics, none of your feed, and no identifier for
you or for uFeed. Their handling of that request is governed by their own
privacy policy. These downloads are the only times uFeed contacts any server.

uFeed sends nothing to us. We operate no server that uFeed talks to.

## Permissions, and why each is needed

| Permission                                             | Why                                                                                                                                                                   |
| :----------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access to x.com, twitter.com, linkedin.com, reddit.com | To read post text in the page and apply the blur. These are the only sites uFeed runs on.                                                                             |
| `storage`                                              | To keep your settings and, if you turn it on, your thumb ratings on your device.                                                                                      |
| `offscreen` (Chrome only)                              | To keep a hidden extension page open for the shared multilingual model worker. The page receives post text from uFeed for scoring; it cannot read the website itself. |

The offscreen permission does not give uFeed access to other websites or
additional data. It does not change what uFeed stores or sends. uFeed cannot
see your browsing history, your bookmarks, your passwords, or your identity.

## Deleting your data

- **Clear tuning**, under "Learn from my thumbs" in the popup, deletes the thumb
  ratings made with the model you are using.
- **Reset**, under "Start over" in the popup, deletes every thumb rating, for
  every model, and restores default settings.
- **Uninstalling uFeed** deletes everything it stored, including your topics.

You do not need to contact us to delete anything, and there is nothing held
elsewhere for us to delete.

## Children

uFeed is not directed at children and collects no data from anyone.

## Changes

If this policy changes, the effective date above changes with it, and a material
change will be noted in the extension's store listing. Questions, or anything
here that does not match what you observe: contact@dephelion.com
