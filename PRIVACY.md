# Privacy Policy

**Last Updated:** September 13, 2026

## Overview

DefPromo is a browser extension. It has no server of its own, no account of its own, and no analytics. Everything it keeps, it keeps in your browser. What it sends anywhere, it sends only to do the thing you just asked for, and this page says exactly what that is.

## What DefPromo itself collects

Nothing. DefPromo:
- ❌ Does NOT collect personal information
- ❌ Does NOT track your browsing activity
- ❌ Does NOT use analytics or tracking tools
- ❌ Does NOT sell or share data with anyone
- ❌ Does NOT run a server that stores your data

## What stays on your device

Your projects, generated content, the analytics DefPromo counts about your own posts, API usage and cost records, logs and settings are stored locally in your browser (IndexedDB). You can export all of it as JSON from Settings and delete it by removing the extension.

## What leaves your browser, and to whom

DefPromo needs a writer to draft text. You choose which one in Settings, and only that one is contacted.

### myna (the default provider)

With myna, DefPromo talks to [mynaposter.com](https://mynaposter.com) over [OpenConnection](https://logicsrc.com/openconnection). You sign in to myna on its own site, make a setup token, and paste it into DefPromo. DefPromo claims the token once and keeps the bearer it receives, stored like a password and shown to nobody. From then on it sends to mynaposter.com, and only when you press the button that needs it:
- the URL of a product you add as a project, so myna can read that page and describe it;
- the project brief (name, description, audience, features, tone, URL) when you ask for posts, comments or suggestions;
- the title and text of the post you are replying to, when you ask for comments;
- keywords you type when asking for suggestions;
- if you ticked the `activity:write` scope: the network, the text and the page URL of a post you filled in through DefPromo, so your myna history and recap can see it.

myna's own privacy policy governs what mynaposter.com does with that. You can see and revoke DefPromo's connection at any time at [mynaposter.com/connect](https://mynaposter.com/connect); a revoked connection stops working immediately and DefPromo forgets it.

### Your own keys

With your own keys, DefPromo sends the same prompts directly to OpenAI using the API key you entered, and, only for a site that serves no `openprofile.md` or `llms.txt`, the product URL to the scraper service you chose (ScrapingBee, ScraperAPI or Browserless) using your key for it. Their privacy policies govern what they do with it. Your keys are stored locally and sent only to the service they belong to.

### The site you add as a project

Before anything scrapes a product page, DefPromo (or myna, on your behalf) requests two public files from that site's own origin: `/.well-known/openprofile.md` and `/llms.txt`. That request carries no data of yours beyond the request itself.

### nichedb.dev

When you ask for suggestions, the keywords are sent to [nichedb.dev](https://nichedb.dev), an open directory that needs no account, to find real forums where those words are discussed. The submit link it offers opens in your browser; nothing is submitted unless you do it there.

## Permissions

- **Active Tab, Tabs, Scripting**: to read the post you are replying to and to fill the compose box on the page you are on, when you ask.
- **Storage**: to keep your projects and settings locally.
- **Content scripts on supported networks**: to add the sidebar and the fill-form button.
- **Host permissions** for mynaposter.com and nichedb.dev, and for the OpenAI and scraper hosts used by the own-keys provider: so the requests above can be made. No request is made to any of them except as described here.

## Changes

If this changes, the date at the top changes with it and the change is listed in the CHANGELOG.

## Contact

Questions: open an issue at [github.com/ralyodio/defpromo](https://github.com/ralyodio/defpromo/issues).
