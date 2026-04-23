# List Source Architecture

## Purpose

This app needs one consistent way to resolve every field that behaves like a list/select value across:

- Master Data pages
- Transaction pages
- Create forms
- Detail edit mode
- Customize mode
- Imports / exports

The goal is to stop hard-coding list values in page components and move toward a shared metadata-driven model.

## Core Rule

Every list field must declare one `sourceType`:

- `reference`
- `managed-list`
- `system`

And one `sourceKey`.

Example:

```ts
{
  id: 'vendorId',
  fieldType: 'list',
  sourceType: 'reference',
  sourceKey: 'vendors',
}
```

```ts
{
  id: 'status',
  fieldType: 'list',
  sourceType: 'managed-list',
  sourceKey: 'LIST-PO-STATUS',
}
```

```ts
{
  id: 'inactive',
  fieldType: 'list',
  sourceType: 'system',
  sourceKey: 'boolean',
}
```

## Source Types

### `reference`

Use for fields backed by real tables/records.

Examples:

- users
- roles
- contacts
- customers
- vendors
- subsidiaries
- currencies
- items
- chart of accounts
- departments
- employees
- accounting periods
- revenue recognition templates

These should never be modeled as `Manage Lists`.

### `managed-list`

Use for business-configurable controlled vocabularies that are not tied to real records.

Examples:

- statuses
- stages
- types
- priorities
- categories
- methods
- triggers
- balance orientation
- payment methods
- consolidation methods

These should come from `Manage Lists`.

### `system`

Use only for values that are truly application-owned and should not be admin-configurable.

Examples:

- boolean `Yes / No`
- maybe a few technical flags

Use this sparingly.

## Naming Convention

Managed lists should use stable keys like:

- `LIST-PO-STATUS`
- `LIST-REQ-STATUS`
- `LIST-BILL-STATUS`
- `LIST-INVOICE-STATUS`
- `LIST-FULFILLMENT-STATUS`
- `LIST-BILL-PAYMENT-STATUS`
- `LIST-JOURNAL-STATUS`
- `LIST-ITEM-TYPE`
- `LIST-ITEM-RECOGNITION-METHOD`
- `LIST-ACCOUNT-TYPE`
- `LIST-NORMAL-BALANCE`
- `LIST-PAYMENT-METHOD`
- `LIST-ENTITY-TYPE`
- `LIST-CONSOLIDATION-METHOD`

Rule:

- prefix all business-managed lists with `LIST-`
- use transaction/entity abbreviation + field name
- keep keys stable even if labels change

## What Should Stay Reference-Backed

These are explicitly **not** `Manage Lists`:

- Users
- Roles
- Contacts
- Customers
- Vendors
- Subsidiaries
- Currencies
- Items
- Chart of Accounts
- Departments
- Employees

This is the expected baseline across all current and future pages.

## Current State Inventory

The app already has partial managed-list support through `list_options`, but list handling is currently mixed.

Important nuance:

- there is an existing database-backed managed-list system in `list_options`
- there is also a broader `/lists` admin UI that exposes those keys and can also hold custom list definitions
- so the right strategy is **reuse first, add only what is missing**

We should not duplicate an existing list just for naming consistency unless the current key is unusable.

### Reconciliation outcome

#### Reuse these existing managed lists

These keys already exist in `list_options` today and should be treated as the canonical starting point:

- `BILL-STATUS`
- `DIVISION`
- `FULFILL-STATUS`
- `INDUSTRY`
- `INV-RECEIPT-STATUS`
- `INV-STATUS`
- `ITEM-TYPE`
- `LEAD-RAT`
- `LEAD-SRC`
- `LEAD-STATUS`
- `OPP-STAGE`
- `PO-STATUS`
- `QUOTE-STATUS`
- `RECEIPT-STATUS`
- `REQ-STATUS`
- `SO-STATUS`

Recommendation:

- keep these keys
- map field metadata to them
- only introduce aliasing or naming cleanup if needed later

#### Existing lists that are present but not consistently wired everywhere

These business concepts already have managed-list keys, but some pages/forms still use page-local arrays or hard-coded selects:

- Purchase Order status -> `PO-STATUS`
- Purchase Requisition status -> `REQ-STATUS`
- Bill status -> `BILL-STATUS`
- Invoice status -> `INV-STATUS`
- Sales Order status -> `SO-STATUS`
- Quote status -> `QUOTE-STATUS`
- Receipt status -> `RECEIPT-STATUS`
- Fulfillment status -> `FULFILL-STATUS`
- Invoice Receipt status -> `INV-RECEIPT-STATUS`
- Customer industry -> `INDUSTRY`
- Item type -> `ITEM-TYPE`
- Lead source -> `LEAD-SRC`
- Lead rating -> `LEAD-RAT`
- Lead status -> `LEAD-STATUS`
- Opportunity stage -> `OPP-STAGE`
- Department division -> `DIVISION`

These should be migrated onto the shared list-source contract, not recreated.

#### Truly missing or still mostly hard-coded

These are the ones that still look like real candidates for new managed-list keys or later normalization:

- Bill Payment status
- Journal status
- Chart of Accounts `accountType`
- Chart of Accounts `normalBalance`
- Item `recognitionMethod`
- Item `recognitionTrigger`
- Subsidiary `entityType`
- Subsidiary `consolidationMethod`
- Payment method
- Exchange Rate `rateType`

### Already using managed-list style

- Customer `industry`
- Item `type`
- Lead `source`
- Lead `rating`
- Lead `status`
- Opportunity `stage`

### Still hard-coded / page-local today

Transactions:

- Bill Payment status
- Journal status

Master data / setup:

- Chart of Accounts `accountType`
- Chart of Accounts `normalBalance`
- Item `recognitionMethod`
- Item `recognitionTrigger`
- Subsidiary `entityType`
- Subsidiary `consolidationMethod`
- Exchange Rate `rateType`

System-owned / likely keep as `system`:

- Inactive `Yes / No`
- Base Currency `Yes / No`
- other simple booleans

## First-Pass Managed Lists To Add

High-value next lists that do **not** already exist:

1. `LIST-BILL-PAYMENT-STATUS`
2. `LIST-JOURNAL-STATUS`
3. `LIST-ACCOUNT-TYPE`
4. `LIST-NORMAL-BALANCE`
5. `LIST-ITEM-RECOGNITION-METHOD`
6. `LIST-ITEM-RECOGNITION-TRIGGER`
7. `LIST-PAYMENT-METHOD`
8. `LIST-ENTITY-TYPE`
9. `LIST-CONSOLIDATION-METHOD`

Potential later decision:

- `LIST-RATE-TYPE`
  only if exchange-rate types are intended to be admin-managed rather than system/integration-defined

## Shared Resolver Recommendation

Build one shared resolver layer that every field can use:

### `reference`

Resolver loads options from a table/query.

Examples:

- `vendors`
- `customers`
- `employees`
- `items`
- `subsidiaries`
- `currencies`
- `chartOfAccounts`

### `managed-list`

Resolver loads rows from `list_options` by `sourceKey`.

Example:

- `LIST-PO-STATUS`

### `system`

Resolver returns shared app-level options.

Examples:

- `boolean`
- maybe `activeInactive`

## Field Metadata Contract

Every future list field should support:

```ts
type FieldSourceType = 'reference' | 'managed-list' | 'system'

type FieldDefinition = {
  id: string
  label: string
  fieldType: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'list'
  sourceType?: FieldSourceType
  sourceKey?: string
  helpText?: string
}
```

That metadata should drive:

- create forms
- edit mode
- customize mode
- imports
- exports

## Why This Comes Before More Shared Components

The next round of shared components should not be built on top of inconsistent list-loading rules.

If we settle this first:

- shared components can stay simple
- field definitions become more reusable
- new fields become cheaper to add
- `Manage Lists` becomes the system of record for configurable dropdown values

## Recommended Sequence

1. Approve this source model
2. Add shared list resolver helpers
3. Expand `Manage Lists` keys for the high-value list set
4. Start updating field definitions to include `sourceType` and `sourceKey`
5. Continue shared component refactor on top of that contract

## Future Follow-Up

Once this contract is in place, we should also use it later for:

- transaction import templates
- transaction export templates
- custom field select options
- validation
- global company/user formatting and preference-aware rendering
