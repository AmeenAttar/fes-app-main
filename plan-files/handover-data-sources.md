# Data Sources

Every screen's content comes from somewhere the Cleveland FES Center already
maintains. There is no separate spreadsheet or CMS to keep in sync — editing the
website is what updates the app.

> Replaces the former `handover-google-sheets-production.md`. The Google Sheets
> integration was removed in August 2026; `GOOGLE_SHEETS_API_KEY` is no longer
> used anywhere and `lib/sheets.ts` was deleted.

---

## Where each screen gets its data

| Screen | Source | API route |
|---|---|---|
| News (list + article) | WordPress REST API on fescenter.org | `/api/news`, `/api/news/:id` |
| Investigators | HTML scrape of `/team/investigators/` and each profile page | `/api/investigators`, `/api/investigators/:slug` |
| Equipment Inventory | Child pages of `/equipmentrepo/` via WP REST | `/api/equipment`, `/api/equipment/:slug` |
| Supporting Resources | `<h3>` sections on `/supporting-resources/` via WP REST | `/api/supporting-resources` |
| Events, FES Calendar, Tuesdays | Public Google Calendar iCal feed | `/api/events`, `/api/events/:id` |
| Weather widget | api.open-meteo.com | `/api/weather` |

Only four hosts are contacted: `fescenter.org`, `calendar.google.com`,
`api.open-meteo.com`, and Expo's push service. The calendar feed is deliberately
*not* derived from `FESCENTER_BASE_URL` — it lives on Google and is unaffected by
website changes.

---

## Why the parsers are deliberately schema-less

The Center edits its own site, so the parsers read **shape**, not fixed field
lists. This is the single most important thing to preserve when changing them.

**Equipment** (`routes/equipment.ts`) — each item page is a run of
`<strong>Label</strong>: value` pairs. Every `<strong>` that reads as a field
label (a colon on either side of the tag) becomes a row, whatever it says. A
`<strong>` with no colon nearby is treated as emphasis *inside* a value, so bolded
mid-sentence text doesn't split a value or appear as a junk row.

**Supporting Resources** (`routes/supporting-resources.ts`) — sections are
whatever `<h3>` headings exist; contacts are the `<li>` items beneath each. Within
an item, the address is found by looking for an email anywhere (a `mailto:` link or
bare text) and the remaining pipe-separated parts become the name plus an optional
qualifier.

Consequences, all intentional:

- Adding, removing, renaming, or reordering an item, a person, or a whole section
  on the website needs **no app change**.
- Field wording can vary between entries. It already does: some equipment pages say
  "Contact PI", others "Contact Person"; most resource entries read
  `Name | email` but FDA Support Core reads `Name | Regulatory | email`.
- A new field the Center invents shows up automatically.

If you replace a parser, keep this property. Hard-coding the current field names
would work today and silently drop data the first time someone edits the site.

---

## Overrides

Both source pages can be repointed without a code change:

| Variable | Default | Use |
|---|---|---|
| `FESCENTER_BASE_URL` | `https://fescenter.org` | Site root for news + investigators |
| `EQUIPMENT_REPO_SLUG` | `equipmentrepo` | If the equipment page is renamed |
| `SUPPORTING_RESOURCES_SLUG` | `supporting-resources` | If the resources page is renamed |

---

## Failure behaviour

Every route caches (5–10 min) and **serves the last good copy for up to 24 hours**
when the upstream fails, rather than erroring. The events route additionally
mirrors its cache to disk, because Google rate-limits the iCal feed per IP and
repeated cold starts were what triggered it.

Parsing to *zero* results is treated as an error, not an empty success. That
distinction matters: a scrape that silently returns nothing is how the retired
`/test` URLs went unnoticed, and how the site's cookie banner ended up inside every
investigator bio. Those failures now surface through Sentry when `SENTRY_DSN` is
set.

---

## Known upstream breakage

**All 37 equipment images 404.** The URLs embedded in the Center's own equipment
pages point at files no longer in their media library — the images are broken on
the public website too. The app detects the load failure and falls back to a
branded placeholder, so nothing looks broken, but real photos will only appear once
the Center fixes those links. Worth raising with whoever maintains the site.
