# Page Framework Checklist

Use this checklist for both:
- reworking an existing page onto the shared framework
- creating a new page from the shared framework

## 1. Shared Framework First
- Use the shared master-data framework or shared transaction framework first.
- Add page-specific behavior as thin configuration or targeted add-ons.
- Avoid introducing page-local layout/action patterns when the shared layer can own them.

## 2. Backend Schema Audit
- Review the full backend table/model before marking the page complete.
- Compare the schema against:
  - list page columns
  - detail page fields
  - create/edit inputs
  - customize layout availability

## 3. UI Field Coverage Gate
- Every backend field must be categorized as one of:
  - exposed on list page
  - exposed on detail page
  - editable on create/edit
  - available in customize layout
  - intentionally omitted with a reason

## 4. List Page Coverage
- Review important operational/system fields for list visibility, especially:
  - record id / transaction number
  - linked ids
  - status
  - subsidiary
  - currency
  - created
  - last modified
  - db id where useful
- If a list has more than 10 value columns, default the page to the top 10 highest-value columns and make the rest optional through column selection.

## 5. Detail Page Coverage
- Expose all relevant backend fields on the detail page, either directly or as derived display values.
- Group them into meaningful sections/subsections rather than one long field block.
- Review the page in sections:
  - Header section
  - Line section
  - Detail/related sections
- If the transaction has line items, the line section must support adding lines in the appropriate create/edit flow.

## 6. Create/Edit Coverage
- Confirm which fields are:
  - editable
  - read-only/derived
  - system-managed
- `+ New` should match detail-page edit mode visually unless there is a deliberate exception.
- A thin form-in-a-card create page does not pass this gate; transaction create pages should use the same section and shared-header language as detail edit mode.

## 7. Customize Coverage
- Confirm all intended detail-page fields are available to the customize layout engine.
- Confirm line-column customization and stat-card customization are wired where applicable.

## 8. Related Documents / Communications
- Transaction pages should use the shared related-documents and communications patterns.
- Prefer shared payload builders/helpers instead of page-local mapping logic.
- Detail pages should be rich by default. If a transaction truly should not have stats, related docs, communications, system notes, or line items, document the exception explicitly instead of silently shipping a thin page.

## 9. Validation
- Run lint and typecheck before handing off.
- Sanity-check that shared changes do not break sibling pages.
