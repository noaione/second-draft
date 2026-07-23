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

## license

WTFPL – do whatever you want with it.

### warning

vibe coded because i just want to read stuff from what I subscribe in patreon.

although i personally work on the dynamic content parsing + SQLite caching myself because
using nuxt/content is too limited for my needs.

since i want the server to keep running while I pull new content and then dynamically render the content on demand.
