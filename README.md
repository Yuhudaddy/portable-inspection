# Portable Inspection

A lightweight mobile-first PDF tool for field record entry.

## Deployment

Production: **https://portable-inspection.pages.dev/** — a Cloudflare Pages project connected to this repository (no build step, output directory `/`), redeployed on every push to `main`. `_headers` sets `Cache-Control: no-cache` on `sw.js` and the manifest. Internal links are extension-less (`./diaphragm-wall`, not `.html`) because Pages redirects `*.html` URLs. The same branch is also published by GitHub Pages at **https://yuhudaddy.github.io/portable-inspection/** (kept as a second, identical mirror; note GitHub Pages cannot set headers, so a new `sw.js` there can lag up to 10 minutes behind a push). `.nojekyll` keeps GitHub from running Jekyll on the files.

The site opens at `index.html`, which is the tool index:

| # | Tool | Page | Scope |
| --- | --- | --- | --- |
| 01 | 連續壁 | `diaphragm-wall-select.html` | Version picker linking the two diaphragm-wall tools below: 品管版 (quality control) and 完整版 (full record). |
| 01a | 連續壁・品管版 | `diaphragm-wall-gc.html` + `wall-gc.js` | General-contractor hold-point inspection: design baseline, monitoring conclusion, trenching / cage-lowering / pour release, plus Guide Wall and Rebar Cage reviews. Imports the vendor tool's JSON. |
| 01b | 連續壁・完整版 | `diaphragm-wall.html` + `app.js` | Vendor field record: wall unit, quality self-check, excavation, pre-work and concrete pour logs, plus Guide Wall and Rebar Cage reviews. |
| 02 | 模板 | `template.html` + `template.js` | RC formwork review, measurement, pour release and stripping. |
| 03 | 鋼筋 | `rebar.html` + `rebar.js` | RC rebar review: member matrix with bar details, material, placement, splice/cover and pour release. |
| 04 | 鋼構 | `steel-structure.html` + `steel.js` | Steel erection review: delivery, anchor bolts, erection, HSB, welding, accuracy and optional records. |
| 05 | 施工架 | — | Placeholder (returns 404). |

Within both diaphragm-wall tools the unit number and sequence number live on the wall record; the Rebar Cage review edits the same two fields (both tabs stay in sync), and the Guide Wall review is identified by an axis / direction number (`axis_no`) instead of a unit. The Guide Wall numeric items (clear width, depth, wall thickness, rebar, concrete strength, top elevation) are shared by both tools in `guide-wall.js`: each takes a design and a measured value, and a failing value auto-selects ✗ and disables ✓ (rebar that matches the design size with spacing ≤ design auto-selects ✓). The same rules (in `auto-judge.js`) drive the numeric hold-point items of 品管版 and the numeric quality self-check items of 完整版: values are normalized first (full-width digits, trailing units, `GL` prefix, `1/n`), non-numeric input is flagged "請輸入數值" with ✓ disabled, and changing a standard value in the dropdown re-judges immediately. Each tool's JSON also carries its construction-plan cover fields — preparer, date and brief/full version (`construction_plan`; the revision history is not user data), and 還原預設 clears that plan draft. Every tool's header has a 計畫 button that opens `plan.html?work=…&from=…`: a construction plan for that work type (連續壁 has separate 品管版 and 完整版 plans, plus 模板, 鋼筋, 鋼構) with a brief / full version switch, cover, revision history and table of contents, printable to PDF; the content lives in `plans/*.js`, the revision history and cover version are maintained by the plan author in `plans/revisions.js` (read-only on the page), flowcharts are Mermaid sources in `plans/flowcharts-diaphragm-wall.js` rendered by `vendor/mermaid.min.js`, and the other cover fields are kept as a local draft. Every tool exports PDF (current form or the whole record) and JSON from the gooey menu on the dock's export button (`export-menu.js`); only the two diaphragm-wall tools can import JSON, from a fourth menu item. Legacy `record.html` and `checklists.html` URLs redirect to the vendor Diaphragm Wall tool. Shared modules loaded by every page: `glass.css` (design tokens), `draft.js` (local drafts), `export-menu.js` (export menu on tool pages), `print-pages.js` (print pagination and PDF helpers), `dialog-forms.js`, `sw-client.js`.

## Field workflow

1. Open the Pages URL on a phone and select an engineering record category from the tool index.
2. For the diaphragm-wall tools, pick the Diaphragm Wall, Guide Wall, or Rebar Cage record from the record switcher.
3. Enter the project and wall baseline, then add excavation, pre-work, and concrete records. Each record tab keeps its own date; times that cross midnight are shown in 30-hour form (23:50 → 24:20).
4. Review calculated counts, cumulative volume, estimated rise, measured rise, and differences. The pour log shows plausibility reminders (implausible gaps between dispatch / unload / finish, out-of-order trucks, times past 30:00, truck volume ≤ 0 or > 15 m³); they never block input.
5. Tap the export button (⬆, bottom right); pick 單頁 (current form PDF) or 整份 (complete record PDF), and share the result to LINE or Files. JSON is the canonical structured file (schema 1.5; the rebar-cage review carries `mode` and 13 fixed `parts`, the guide-wall review carries `axis_no`) and can be imported back through the menu's **匯入** item on the two diaphragm-wall tools; older 1.x files are migrated on import.

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
| `scripts/verify_data.py` | Engineering calculations (design height / volume, depth differences, cumulative pour, 30-hour clock, pour reminders), JSON export → import → export round-trip for both diaphragm-wall tools, migration of 1.2–1.3 JSON files and drafts, the shared bar-size list and rebar-cage part helpers, the rebar-cage simple / detailed UI (mode toggle, interval dialog, symmetric linkage), that failed / pending items, unit labels and both rebar-cage tables appear in the PDF text, the axis number and unit / sequence sync on both diaphragm-wall tools, the two-step member delete on the formwork and rebar tools, and the construction-plan page (both versions, cover prefill, tool links). |
| `scripts/verify_print_layout.py` | Empty and oversized forms for every tool: signature block stays at the bottom of the last page, rotated pages included; the four construction plans print with cover, revision history and table of contents on their own pages. |
| `scripts/render_example_pdfs.py` | Regenerates `examples/*.pdf`, the `examples/pages/*.webp` previews and their manifest from the example data. |

Bump `CACHE_NAME` in `sw.js` on every change that affects served files; the service worker reloads open pages once the new version takes over.

## Data handling

The tool keeps draft values in the current browser's local storage. It does not provide a server-side database, user accounts, cross-device synchronization, or a centralized submission workflow. Drafts are browser-profile-specific and are not encrypted; shared devices should be cleared after use.

## Security boundary

The site is a public, static Cloudflare Pages application. It has no authentication or private record repository. Entered form values remain in page memory and are not uploaded by the application; downloaded files are controlled by the user's device. Do not place confidential or personally identifiable production data in public example files.
