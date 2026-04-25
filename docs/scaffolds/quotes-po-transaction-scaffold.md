PO-style transaction scaffold memory for Quotes (quotes)

Goal: make Quotes behave like Purchase Orders for + New, detail, edit detail, and customize layout.

Required files / edits:
1. prisma/schema.prisma: confirm Quote header + line model fields, relations, indexes, and status/source columns needed for PO-style page parity.
2. src/lib/company-preferences-definitions.ts: add quotes transaction Id setting if missing.
3. src/lib/quotes-number.ts: generated transaction number helper using Company Prefs.
4. src/lib/quotes-detail-customization.ts: define QuoteDetailFieldKey, QuoteDetailCustomizationConfig, QUOTE_DETAIL_FIELDS, line columns if applicable, default sections, rows, and formColumns.
5. src/lib/quotes-detail-customization-store.ts: load/save/merge/normalize customization config.
6. src/app/api/config/quotes-detail-customization/route.ts: GET/POST customization API.
7. src/components/QuoteDetailCustomizeMode.tsx: copy PO live section/grid customizer pattern, including section add/rename/reorder/delete, row counts, drag/drop field placement, visibility, required toggles, and line-column toggles if applicable.
8. src/components/QuoteCreatePageClient.tsx: PO-style full-page create shell using RecordDetailPageShell + PurchaseOrderHeaderSections equivalent.
9. src/components/QuotePageActions.tsx: top-right action row with + menu, export, Customize, Edit, Delete, Save/Cancel in edit mode.
10. src/components/QuoteHeaderSections.tsx or reuse PurchaseOrderHeaderSections: sectioned/grid header rendering for view/edit/new.
11. src/components/QuoteCreateForm.tsx and/or line form sections: ensure create uses the same section/grid layout as edit.
12. src/app/quotes/new/page.tsx: full page only, no modal. Must match edit layout and support duplicateFrom.
13. src/app/quotes/[id]/page.tsx: regular detail, edit detail, customize mode; wire Customize button, + New/Duplicate menu, export, related sections, system info, system notes.
14. src/app/quotes/page.tsx: list page should link first identifier column to detail page, not rely on modal edit as the primary experience.
15. src/app/api/quotes/route.ts: CRUD plus activity logging and field-change system notes. Make sure create/update return all relations needed by detail page.
16. src/lib/form-requirements.ts: add quoteCreate defaults and labels so required toggles work in customize mode.
17. src/lib/list-source.ts and src/lib/managed-list-registry.ts: all list fields on Quote must be backed by managed/reference/system sources; no hardcoded page-local arrays.
18. src/components/SystemNotesSection.tsx + load system info/notes helpers: add bottom sections exactly like PO/detail standard.
19. Related sections: copy PO standard for child/related docs as applicable to Order to Cash flow (e.g. quotes->SOs->invoices for OTC, requisitions->POs->receipts/bills for PTP).
20. Export: wire PO-style detail export and list export behavior.
21. Verification: lint changed files, tsc, route smoke test, quotes/new load, quotes/[id]?edit=1 load, quotes/[id]?customize=1 load.

PO pattern principles to preserve:
- + New is always a full page, never a modal.
- Detail regular mode shows top actions: + menu, export, Customize, Edit, Delete.
- Customize mode uses the same sections and grid cells as edit mode, not a separate simplified layout.
- Edit mode and New mode share the same header sections and field placements.
- System Notes and System Info live at the bottom.
- If the transaction has lines, GL impact, or related docs, they sit in framed sections below the header area.

Implementation notes:
- Prefer reusing RecordDetailPageShell, PurchaseOrderHeaderSections, PurchaseOrderDetailExportButton, and the journal transaction pattern where practical.
- Safe starter stubs may be generated, but existing files must never be overwritten.
