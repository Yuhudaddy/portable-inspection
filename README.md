# Portable Inspection

A lightweight mobile-first PDF tool for field record entry.

## Deployment

Production: **https://portable-inspection.pages.dev/** — a Cloudflare Pages project connected to this repository (no build step, output directory `/`), redeployed on every push to `main`. `_headers` sets `Cache-Control: no-cache` on `sw.js` and the manifest. Internal links are extension-less (`./diaphragm-wall`, not `.html`) because Pages redirects `*.html` URLs. The former GitHub Pages site (`yuhudaddy.github.io/portable-inspection`) was retired on 2026-09-17; the repository stays as the source for Cloudflare Pages.

The site opens at `index.html`, which is the tool index. The Diaphragm Wall entry tool is `diaphragm-wall.html`; its Diaphragm Wall unit record, Guide Wall review, and Rebar Cage review share one application and one PDF workflow. The template entry tool is `template.html`; it provides a mobile-first RC formwork review, measurement, pour-release, stripping, PDF, JSON, and Markdown workflow. The steel-structure entry tool is `steel-structure.html`; it provides a mobile-first general-contractor review for member delivery, anchor bolts/column bases, erection and temporary fixing, high-strength bolts, field welding, installation accuracy, and optional studs/deck/grouting records. Rebar and scaffold links remain placeholders. Legacy `record.html` and `checklists.html` URLs redirect to the Diaphragm Wall tool.

## Field workflow

1. Open the Pages URL on a phone and select an engineering record category from the tool index.
2. Select the Diaphragm Wall or Formwork tool from the visible record index. For the Diaphragm Wall tool, select the Diaphragm Wall, Guide Wall, or Rebar Cage record from the visible record switcher.
3. Enter the project and wall baseline, then add excavation, pre-work, and concrete records.
4. Review calculated counts, cumulative volume, estimated rise, measured rise, and differences.
5. Choose **輸出**, select the current form or the complete record PDF, and share the result to LINE or Files. The Diaphragm Wall tool can also export JSON/Markdown; JSON is the canonical structured file and can be imported back through **輸出 → 匯入施工紀錄** on the same Diaphragm Wall page. Markdown is for reading and archiving only and is not used for form restoration. The template tool has its own separate JSON/Markdown export and is not compatible with the Diaphragm Wall import.

The tool automatically saves a draft in the browser's local storage. Each tool has its own independent draft: all tabs within the Diaphragm Wall, Template, Rebar, or Steel Structure tool are saved together, while drafts are not shared between tools. Refreshing or closing the page restores the draft on the same browser profile. The Clear action removes that tool's draft. The PDF remains the handoff artifact, and JSON export remains available for explicit backup or transfer to another device.

## Local preview

Open `index.html` in a modern browser, or run a local static server:

```bash
python3 -m http.server 4173
```

## Data handling

The tool keeps draft values in the current browser's local storage. It does not provide a server-side database, user accounts, cross-device synchronization, or a centralized submission workflow. Drafts are browser-profile-specific and are not encrypted; shared devices should be cleared after use.

## Security boundary

The site is a public, static GitHub Pages application. It has no authentication or private record repository. Entered form values remain in page memory and are not uploaded by the application; downloaded files are controlled by the user's device. Do not place confidential or personally identifiable production data in public example files.
