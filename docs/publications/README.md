# DefPromo publications

This bundle describes what each published version actually does. Store descriptions and screenshots are maintained separately from package uploads; a successful release workflow does not mean either the listing copy or a reviewed package is live.

## Publication inventory

Checked September 13, 2026 against the public store pages, the AMO API, repository release configuration and package contents.

| Publication                                                                                            | Existing distribution                                                                             | Copy and assets                                                                              |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [Chrome Web Store](https://chromewebstore.google.com/detail/defpromo/efdlekcpbjccbilfonhbdicfoaklanap) | Chrome/Chromium; also used by Edge                                                                | `summary.txt`, `chrome-description.txt`, `screenshots/chrome/`                               |
| [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/defpromo/)                            | Published Firefox package was 1.4.9 during this audit                                             | `firefox-metadata.json`, `firefox-description.txt`, `screenshots/firefox/`                   |
| [defpromo.com](https://defpromo.com)                                                                   | Redirects to this repository's README                                                             | README updated with the same feature and privacy distinctions                                |
| Microsoft Edge Add-ons, Opera Add-ons, Apple App Store                                                 | No separate listing found in repository links, publisher configuration or targeted store searches | Do not invent listings or claim App Store availability. Safari is a build/conversion target. |

The source release adds OpenProfile and OpenConnection in 1.5.0. Firefox copy names those as a version distinction while 1.4.9 remains publicly offered, and its screenshots come from that exact AMO XPI. Recheck the current store package before applying future metadata. The update script deliberately stops if the published package no longer matches the screenshot version.

At 10:46 UTC on September 13, the Firefox description, summary, paid-service disclosure and two new screenshots were publicly verified; the previous screenshot was removed. Release 1.5.1 was successfully submitted to AMO as version 6482233 and awaits review. Chrome accepted the 1.5.1 package submission, while its update service still offered 1.5.0. Firefox still offered 1.4.9, so its live description remains matched to that version. Chrome's detailed listing copy and images are ready for the publisher's manual dashboard upload. Package submission does not establish public availability.

## Evidence behind the copy

| Claim                                  | Evidence and limit                                                                                                                                                                                                                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project briefs and editable variations | `src/sidepanel/views/ProjectsView.jsx` and `ContentView.jsx`; separate project context, draft history, Edit, Copy Content and Fill Form actions.                                                                                                                                                   |
| Local activity history                 | `ContentView.jsx` records an analytics row after a successful form fill. This is not proof that a post was published. `AnalyticsView.jsx` asks the user to enter likes, comments and shares manually. No scheduling, reach, follower-growth or automatic engagement-sync implementation was found. |
| OpenProfile                            | `src/services/sitefiles.js` reads `/.well-known/openprofile.md` and `/llms.txt` before scraper fallback. Added in 1.5.0; not a feature of the published Firefox 1.4.9 package.                                                                                                                     |
| OpenConnection                         | `src/services/myna.js` implements setup-token claim, scoped access, revocation and disconnect. mynaposter.com is the currently integrated provider; the provider is not the specification. No OpenServer integration is claimed.                                                                   |
| NicheDB                                | `src/services/nichedb.js` queries the directory's forum collection; it is a directory implementation, not a standard or a guarantee of appropriate promotion destinations.                                                                                                                         |
| Setup and costs                        | `src/services/provider.js` and Settings select myna or the own-key path. Firefox 1.4.9 contains only the own-key path. No free-provider allowance is promised.                                                                                                                                     |
| Data flows                             | `PRIVACY.md`, provider calls and `src/storage/db.js`: local storage plus action-specific requests to the selected provider, scraper, product origin or directory. Optional `activity:write` sends form-fill text and URL to myna. Exported settings can include credentials.                       |

## Screenshots

Each PNG is 1280×800, showing the actual packaged React UI in a disposable local browser fixture. No UI was redrawn, no provider was called, and nothing was posted. The project is visibly named **Field Notes — example project** and saved variations begin **Sample draft**. No performance numbers or customer data are seeded. The cost widget's zero reflects that no API requests were made by this fixture; it is not a claim of free service.

Firefox captures use the publicly downloaded 1.4.9 XPI. Chrome captures use the current source package. `capture.json` records the version and method. The fixture supplies a read-only browser tab query and runtime listener shims while rendering the unmodified packaged UI; it does not claim a native Firefox browser screenshot or a live social-account session.

The Firefox listing uses the first two screenshots; Chrome uses all three. The additional Firefox Settings capture is included as a reusable asset. Recommended order and captions:

1. `02-drafts.png`: Review, edit or copy saved variations. Example project and sample drafts.
2. `01-project.png`: Keep a product brief and reusable project context locally. Example project.
3. `03-settings.png`: Choose and configure your provider. No credentials entered. Firefox 1.4.9 shows the own-key setup; Chrome shows OpenConnection through myna.

To reproduce, install Playwright in a tooling environment and point `PLAYWRIGHT_MODULE` at its module if it is not resolvable from this repository:

```sh
pnpm build:chrome
node scripts/capture-publication-screenshots.mjs dist/chrome docs/publications/screenshots/chrome
node scripts/capture-publication-screenshots.mjs /path/to/unpacked-published-firefox-xpi docs/publications/screenshots/firefox
```

`CHROMIUM_PATH` can select an installed Chromium executable. All non-local network requests are blocked and fail the capture check. Read and inspect every screenshot before publishing.

## Applying the Firefox listing

Credentials are read only from the private file named by `DEFPROMO_PUBLISHER_ENV`; no credentials are committed or logged. The existing publisher vault is `profullstack/defpromo--prod`. The metadata update preserves the add-on ID, package, listing URL and support fields. It replaces the old screenshot only after all new screenshots have uploaded and received captions. A public state file makes interrupted uploads resumable.

```sh
node scripts/update-amo-listing.mjs
DEFPROMO_PUBLISHER_ENV=/path/to/private.env node scripts/update-amo-listing.mjs --apply
```

The first command is read-only. The second updates the existing listing through the [AMO metadata and preview API](https://github.com/mozilla/addons-server/blob/master/docs/topics/api/addons.rst), verifies the public metadata, and records uploaded preview IDs in `firefox-publication.json`. AMO rate limits can require paced retries; CDN caches may lag the canonical data for several minutes.

## Applying the Chrome listing

The [Chrome Web Store API](https://developer.chrome.com/docs/webstore/api/reference/rest) uploads packages and submits releases; it does not expose editing of the long description or screenshots. Those changes require the signed-in [developer dashboard](https://chrome.google.com/webstore/devconsole).

For item `efdlekcpbjccbilfonhbdicfoaklanap`, open **Store listing**, replace the detailed description with `chrome-description.txt`, upload the three Chrome PNGs in the order above, save and submit the listing changes for review. The short summary comes from the package's `description`, now matching `summary.txt`. Do not change the extension ID, permissions or publisher privacy answers as a workaround for listing access.

Chrome OAuth publishing credentials do not create a signed-in dashboard session. When dashboard access is unavailable, this complete copy and image bundle remains ready to apply; uploading a ZIP alone must not be reported as updating its detailed listing.
