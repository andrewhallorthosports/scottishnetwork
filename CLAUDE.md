# SCOTTISH Network website — project guide for Claude

This repository is the **static website for the SCOTTISH Network** (Scottish Centres
for Orthopaedic Treatment & Innovation in Surgery & Healthcare), published via
**GitHub Pages** at **https://scottishnetwork.net** (custom domain set in `CNAME`).

There is no build step. The files in the repository are served exactly as they are.
**Pushing to `main` deploys the live site.**

## Repository layout

- `index.html` — the homepage / research hub (navigation, "Published Studies" grid, contact, about).
- One folder per study, each containing an `index.html`, served at `/<folder>/`:
  - `young-TKA/` — knee arthroplasty under 50 years (KSSTA, 2026)
  - `velys-review/` — VELYS robotic-assisted solution scoping review (JEO, 2026)
  - `snap-femur/` — periprosthetic femur fractures (Bone & Joint Journal, 2026)
  - `glp1-oa/` — GLP-1 receptor agonists and OA (BJSM, 2026)
  - `ras-perceptions/` — perceptions of robot-assisted arthroplasty (Bone & Joint Open, 2026)
- `CNAME`, `README.md`.

**Folder slugs are case-sensitive** on GitHub Pages. For example the knee arthroplasty
study lives at `young-TKA/` (capital TKA) and must be linked as `young-TKA/`.

## Design system (shared across all pages)

Each page is a single self-contained HTML file with an inline `<style>` block using the
same tokens: a navy/stone palette with a light-blue accent, `Inter` for text and
`JetBrains Mono` for eyebrows/labels, and a `.fade-up` scroll-reveal animation.

Journal logos, cover images and infographics are embedded as **base64 `data:` URIs**.
Do not truncate, re-wrap, or otherwise alter these blobs when editing a file.

## Critical conventions — do not regress these

1. **No-JavaScript fallback.** Every page's `<head>` contains
   `<script>document.documentElement.className+=' js';</script>`, and the base animation
   rule is scoped to `.js` — i.e. `.js .fade-up { opacity: 0; transform: ...; }` with
   `.fade-up.visible { opacity: 1; ... }`. This makes all content visible when JavaScript
   is disabled (e.g. in-app HTML previews) while keeping the scroll animation when it runs.
   **Never change the base rule back to an unscoped `.fade-up { opacity: 0 }`.**

2. **Research integrity is the top priority.** The site's author is a clinical academic.
   Every statistic, figure, confidence interval, citation and DOI on a study page must
   match the cited publication **exactly**. Do not invent, round, or "improve" numbers.
   When you cannot verify a value against the source, say so rather than guessing. Do not
   label an article "Open Access" / "CC BY" unless the publication actually is.

3. **Study page structure** mirrors the existing pages: journal masthead, hero with
   title/authors/citation and headline stats, structured abstract, findings/key-points
   sections, any tables or infographics, limitations, take-home messages, footer.

4. **Homepage study cards** use the `.study-card` pattern inside `.study-grid`:
   `.study-tag` (eyebrow), `.study-title` (h3), `.study-authors`, a `.study-journal-row`
   link (journal logo `.study-journal-logo` + `.study-journal` citation → external DOI),
   `.study-abstract` summary, and a `.study-link` → the study's own page. When adding a
   new study, create its folder + `index.html` **and** add a matching card to `index.html`.

## Working style

- Keep changes minimal and consistent with the existing markup and tokens.
- Prefer a branch + pull request so changes can be reviewed before they go live; only
  commit directly to `main` when explicitly asked (remember: `main` is production).
- Never commit secrets or API keys.
