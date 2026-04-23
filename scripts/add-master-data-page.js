#!/usr/bin/env node

const name = process.argv[2]

if (!name) {
  console.error('Usage: node scripts/add-master-data-page.js <entity-name>')
  process.exit(1)
}

const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const pascal = slug.split('-').filter(Boolean).map((part) => part[0].toUpperCase() + part.slice(1)).join('')
const repoRoot = process.cwd()

const checklist = [
  `Master data scaffold memory for ${pascal} (${slug})`,
  '',
  'Required files / edits:',
  `1. prisma/schema.prisma: model fields, relations, indexes, @@map.`,
  `2. prisma/migrations/<timestamp>_add_${slug}_master_fields/migration.sql: additive migration plus backfill existing rows.`,
  `3. src/lib/company-preferences-definitions.ts: add IdSettingKey, DEFAULT_ID_SETTINGS, ID_SETTING_DEFINITIONS.`,
  `4. src/lib/${slug}-number.ts: generated ID helper using Company Prefs.`,
  `5. src/lib/${slug}-form-customization.ts and ${slug}-form-customization-store.ts.`,
  `6. src/app/api/config/${slug}-form-customization/route.ts.`,
  `7. src/lib/form-requirements.ts: add ${slug}Create defaults and labels.`,
  `8. src/lib/master-data-list-definitions.ts: add list definition and export settings.`,
  `9. src/components/AppSidebar.tsx and src/app/api/search/route.ts: navigation/global search.`,
  `10. src/app/api/${slug}/route.ts: GET/POST/PUT/DELETE plus activity/system-note logging.`,
  `11. src/components/${pascal}CreateForm.tsx: reusable create form honoring options/initial values/full-page shell.`,
  `12. src/app/${slug}/page.tsx: server-backed list, live search, pagination, export, column selector, Edit/Delete.`,
  `13. src/app/${slug}/new/page.tsx: full create page matching edit detail layout; support duplicateFrom.`,
  `14. src/app/${slug}/[id]/page.tsx: regular/edit/customize modes, New/Duplicate, export, Customize/Edit/Delete.`,
  `15. src/components/${pascal}DetailCustomizeMode.tsx: live edit-page layout customizer using the same sections and grid cells as edit mode; include section add/rename/reorder/delete, section row counts, drag/drop field placement, visibility, and required toggles.`,
  `16. src/lib/master-data-import-schema.ts and src/app/api/master-data/import/route.ts: import schema + import handler.`,
  `17. src/lib/list-source.ts and src/lib/managed-list-registry.ts: managed/reference list labels/options/defaults.`,
  `18. Detail related sections: child/parent/transaction references as applicable.`,
  `19. System sections: MasterDataSystemInfoSection and SystemNotesSection at the bottom.`,
  `20. Verification: prisma migrate deploy, prisma generate, eslint changed files, API CRUD smoke test, page route smoke test.`,
  '',
  'Principle:',
  'A new master-data page is not complete until it has list, detail, edit, live section/grid customize, create, duplicate, import, ID prefs, managed lists, system notes, and related-record visibility.',
]

console.log(checklist.join('\n'))
console.log(`\nRepo: ${repoRoot}`)
