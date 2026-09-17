# Portable Inspection

A lightweight mobile-first PDF tool for field record entry.

## Deployment

Production: **https://portable-inspection.pages.dev/** — a Cloudflare Pages project connected to this repository (no build step, output directory `/`), redeployed on every push to `main`. `_headers` sets `Cache-Control: no-cache` on `sw.js` and the manifest. Internal links are extension-less (`./diaphragm-wall`, not `.html`) because Pages redirects `*.html` URLs. The former GitHub Pages site (`yuhudaddy.github.io/portable-inspection`) was retired on 2026-09-17; the repository stays as the source for Cloudflare Pages.

The site opens at `index.html`, which is the tool index:

| # | Tool | Page | Scope |
| --- | --- | --- | --- |
| 01 | 連續壁（營造廠） | `diaphragm-wall-gc.html` + `wall-gc.js` | General-contractor hold-point inspection: design baseline, monitoring conclusion, trenching / cage-lowering / pour release, plus Guide Wall and Rebar Cage reviews. Imports the vendor tool's JSON. |
| 02 | 模板 | `template.html` + `template.js` | RC formwork review, measurement, pour release and stripping. |
| 03 | 鋼筋 | `rebar.html` + `rebar.js` | RC rebar review: member matrix with bar details, material, placement, splice/cover and pour release. |
| 04 | 鋼構 | `steel-structure.html` + `steel.js` | Steel erection review: delivery, anchor bolts, erection, HSB, welding, accuracy and optional records. |
| 05 | 施工架 | — | Placeholder (returns 404). |
| 06 | 連續壁（廠商） | `diaphragm-wall.html` + `app.js` | Vendor field record: wall unit, quality self-check, excavation, pre-work and concrete pour logs, plus Guide Wall and Rebar Cage reviews. |

Within both diaphragm-wall tools the unit number lives only on the wall record; the Rebar Cage review shows it read-only (same unit), and the Guide Wall review is a site-wide check that is not tied to a unit. Every tool has PDF, JSON and Markdown export; only the two diaphragm-wall tools can import JSON. Legacy `record.html` and `checklists.html` URLs redirect to the vendor Diaphragm Wall tool. Shared modules loaded by every page: `glass.css` (design tokens), `draft.js` (local drafts), `print-pages.js` (print pagination and PDF helpers), `dialog-forms.js`, `sw-client.js`.

## Field workflow

1. Open the Pages URL on a phone and select an engineering record category from the tool index.
2. For the diaphragm-wall tools, pick the Diaphragm Wall, Guide Wall, or Rebar Cage record from the record switcher.
3. Enter the project and wall baseline, then add excavation, pre-work, and concrete records. Each record tab keeps its own date; times that cross midnight are shown in 30-hour form (23:50 → 24:20).
4. Review calculated counts, cumulative volume, estimated rise, measured rise, and differences. The pour log shows plausibility reminders (implausible gaps between dispatch / unload / finish, out-of-order trucks, times past 30:00, truck volume ≤ 0 or > 15 m³); they never block input.
5. Choose **輸出**, select the current form or the complete record PDF, and share the result to LINE or Files. JSON is the canonical structured file (schema 1.3) and can be imported back through **輸出 → 匯入** on the two diaphragm-wall tools; older 1.x files are migrated on import. Markdown is for reading and archiving only.

The tool automatically saves a draft in the browser's local storage. Each tool has its own independent draft: all tabs within the Diaphragm Wall, Template, Rebar, or Steel Structure tool are saved together, while drafts are not shared between tools. Refreshing or closing the page restores the draft on the same browser profile. The Clear action removes that tool's draft. The PDF remains the handoff artifact, and JSON export remains available for explicit backup or transfer to another device.

## Local preview

Run the bundled static server (it mirrors Cloudflare Pages' extension-less routing, which the in-app links and the service worker rely on — a plain `python3 -m http.server` returns 404 for them):

```bash
python3 scripts/serve.py 4173
```

## Verification scripts

All scripts drive the real pages in headless Chrome. They need `pip install playwright pymupdf pillow` and a locally installed Google Chrome (`chromium.launch(channel="chrome")`); the servers they start bind to `127.0.0.1` only.

| Script | Checks |
| --- | --- |
| `scripts/verify_data.py` | Engineering calculations (design height / volume, depth differences, cumulative pour, 30-hour clock, pour reminders), JSON export → import → export round-trip for both diaphragm-wall tools, migration of 1.2 JSON files and drafts, and that failed / pending items and unit labels appear in the PDF text. |
| `scripts/verify_print_layout.py` | Empty and oversized forms for every tool: signature block stays at the bottom of the last page, rotated pages included. |
| `scripts/render_example_pdfs.py` | Regenerates `examples/*.pdf`, the `examples/pages/*.webp` previews and their manifest from the example data. |

Bump `CACHE_NAME` in `sw.js` on every change that affects served files; the service worker reloads open pages once the new version takes over.

## Data handling

The tool keeps draft values in the current browser's local storage. It does not provide a server-side database, user accounts, cross-device synchronization, or a centralized submission workflow. Drafts are browser-profile-specific and are not encrypted; shared devices should be cleared after use.

## Security boundary

The site is a public, static Cloudflare Pages application. It has no authentication or private record repository. Entered form values remain in page memory and are not uploaded by the application; downloaded files are controlled by the user's device. Do not place confidential or personally identifiable production data in public example files.
