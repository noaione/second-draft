# #seconddraft

simple patreon (and wattpad) mirror for personal use

mainly created since I hate using patreon to navigate WN content

## installation

```bash
bun install --frozen-lockfile
bun run build
bun run .output/server/index.mjs
```

## configuring and fetching content

see the `config.example.json` file for the configuration options, rename to `config.json` and fill in the values.

basically:
1. set sessionCookie with the list of cookies separated like this: `cookie1=value1; cookie2=value2; cookie3=value3`
2. set the collections of each patreon collections/tag you want to mirror in the `collections` array (see the example config for the format), this requires you to dive into the network inspector to find:
    - `id` for the collection ID if they use collection
    - `tag` for the tag name if they use tagging
    - `campaignId` for the creator campaign/membership ID (this is required for both collection and tag)
3. same thing for wattpad, but you only need to set the `id` for the story ID.
   - example: `https://www.wattpad.com/story/411139801-a-yuri-story-of-mutual-unrequited-love`
   - you would set `id` to `411139801` in the config.


after that run the following
```bash
bun run sync:patreon
```

which would start fetching the content from patreon (and wattpad), the posts will be stored to `./content` folder.

you do not need to restart the server after fetching new content, the server will automatically detect new content and render it on demand (+ cache it).

## image proxy

patreon and wattpad image URLs can be signed or temporary. when the optional `s3` configuration is enabled, second draft re-hosts images in an S3-compatible bucket and rewrites the synced markdown to use its own image proxy.

the sync flow is:

1. parse the markdown into an AST and collect its image nodes
2. remove query parameters from each remote URL and hash the remaining full URL with SHA-256
3. download and upload each unique image to the configured bucket
4. replace the image URL in the markdown AST with a same-origin proxy URL

query parameters are excluded from the hash because signed parameters and expiry tokens can change even when the underlying image is the same. the downloaded content type determines the image extension, with the remote URL extension used as a fallback.

objects are stored with the following key:

```text
[prefix/]<seriesId>/<imageHash>.<extension>
```

for example:

```text
second-draft/wp-123456789/09c3...e42.webp
```

the markdown points to a URL shaped like:

```text
/api/collections/:seriesId/posts/:postId/img-proxy?img=:imageKey
```

the proxy reads the object from S3 and returns it with its original content type and an immutable one-year browser cache header. the bucket can therefore remain private and its credentials are never exposed to the browser. for compatibility, the proxy also checks the former `/:seriesId/:postId/:imageKey` object layout when an image is not found in the current layout.

to enable it, set `s3.enabled` to `true` in `config.json` and provide the endpoint, bucket, and credentials shown in `config.example.json`. `prefix` is optional, and `forcePathStyle` may be needed for providers such as minio or r2.

an individual image failure does not fail the post sync; its original remote URL is left unchanged. URLs already pointing at the image proxy are skipped, so the process is safe to run again.

to migrate images in content that was synced before enabling S3:

```bash
# all collections
bun run backfill:images

# one collection
bun run backfill:images <collectionId>
```

## license

WTFPL – do whatever you want with it.

### warning

vibe coded because i just want to read stuff from what I subscribe in patreon.

although i personally work on the dynamic content parsing + SQLite caching myself because
using nuxt/content is too limited for my needs.

since i want the server to keep running while I pull new content and then dynamically render the content on demand.
