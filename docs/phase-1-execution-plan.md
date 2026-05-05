# Phase 1 Execution Plan

## Purpose

This document converts the Phase 0 architecture stack into an implementation sequence.

It defines:

- schema migration order
- backend service build order
- frontend shared-component build order
- retrofit order for existing pages
- dependency-aware delivery waves

It builds on:

- [enterprise-foundation-build-sheet.md](./enterprise-foundation-build-sheet.md)
- [phase-0-architecture-blueprint.md](./phase-0-architecture-blueprint.md)

The goal is to make the first implementation wave deliberate, dependency-aware, and consistent with the enterprise platform model already defined.

## Execution Principles

1. Build shared foundations before module sprawl.
2. Retrofit core existing pages before broadening into many new modules.
3. Keep backend and frontend moving together.
4. Preserve current runtime behavior while introducing canonical structures behind the scenes.
5. Prefer additive migration steps over destructive rewrites.
6. Treat navigable document ids and linked record ids as shared accent-colored links, not plain text.
7. Treat shared line-item readability as a cross-app contract; lookup-heavy columns must auto-fit or use shared wide defaults so selected values remain readable after selection.

## Phase 1 Scope

Phase 1 should focus on foundational implementation, not full module expansion.

Primary target areas:

- shared schema foundations
- shared backend platform services
- shared frontend platform contracts
- retrofit of the most important current accounting pages

## Recommended Delivery Waves

## Wave 1: Core Canonical Schema Introduction

### Objective

Introduce the first canonical tables and reference structures without breaking existing transactional behavior.

### Schema targets

- canonical GL enrichments
- canonical open-item tables
- canonical clearing tables
- canonical activity-type reference structures
- recurring-revenue policy foundations
- reporting summary/control foundations

### Concrete first migrations

1. reference/catalog tables
   - activity type definition
   - recurring revenue policy definition
   - recurring revenue source definition
   - exchange-rate table / batch / context foundations

2. core accounting support tables
   - `OpenItem`
   - `OpenItemEntry`
   - `OpenItemApplication`
   - `ClearingDocumentHeader`
   - `ClearingDocumentLine`

3. run/control support tables
   - `RunHeader`
   - `RunItem`
   - `RunOutputLink`
   - `RunException`

4. reporting support tables
   - `SummaryGlDefinition`
   - `ReportDefinition`
   - `MetricDefinition`
   - first certification/lock tables

### Exit criteria

- canonical core support tables exist
- no major existing pages are forced to switch immediately
- new backend services can begin dual-writing

## Wave 2: Shared Backend Services

### Objective

Build shared services that write to the new canonical structures.

### Service targets

1. posting lineage service
   - source transaction -> GL linkage normalization

2. open-item service
   - create open items
   - append entries
   - create applications
   - reconstruct balances

3. clearing service
   - generate clearing headers/lines
   - realized FX attribution
   - reversal-safe clearing logic

4. FX/intercompany service
   - exchange-rate context generation
   - paired intercompany validation
   - atomic intercompany posting support

5. run/orchestration service
   - canonical run creation
   - output links
   - exceptions

6. reporting summary service
   - summary GL refresh orchestration
   - snapshot creation
   - stale-state calculation

7. AI governance service
   - capability resolution
   - execution logging
   - approval/override capture

### Exit criteria

- shared services exist behind stable interfaces
- services can be adopted incrementally by current pages and APIs

## Wave 3: Shared Frontend Platform Contracts

### Objective

Build or extend the shared frontend surfaces needed to consume the new backend foundations.

### Frontend targets

1. shared open-item UI surfaces
   - current balance
   - application history
   - as-of/history drill-through

2. shared clearing/reconciliation surfaces
   - applications detail
   - reconciliation workspace shell
   - exception states

3. shared run/exception surfaces
   - run list
   - run detail
   - exception queue

4. shared reporting governance surfaces
   - certification status
   - stale/preliminary/certified labels
   - snapshot/version navigation

5. shared AI control surfaces
   - suggestion review
   - approval/override
   - capability visibility

6. shared package/report UX shells
   - package preview shell
   - secure package access shell
   - compare/diff shell

### Exit criteria

- frontend has reusable shells for the new canonical behaviors
- new modules do not need one-off governance UI

## Wave 4: Retrofit Existing Accounting Core

### Objective

Move the most important existing pages onto the new accounting/control services first.

### First retrofit targets

1. `invoices`
2. `invoice-receipts`
3. `customer-refunds`
4. `bills`
5. `bill-payments`
6. `journals`
7. `currencies`
8. `exchange-rates`
9. `intercompany-journals`

### Retrofit order rationale

- invoices / receipts / refunds and bills / payments are the current open-item core
- journals are necessary for reconciliation-friendly adjustment behavior
- currencies / exchange-rates / intercompany journals complete the accounting control foundation

### Retrofit expectations

- dual-write into canonical support tables where needed
- preserve current UI behavior first
- progressively light up:
  - open-item history
  - clearing records
  - realized FX attribution
  - better reconciliation drill-through

### Exit criteria

- current accounting flows are writing enough canonical data to support real reporting/control adoption

## Wave 5: Reporting/Close Operationalization

### Objective

Turn the reporting and close architecture into first working operator experiences.

### Targets

1. summary GL refresh runs
2. reporting snapshots
3. certification / reopen flows
4. package preview / secure access
5. close checklist base flow
6. reconciliation base flow

### Initial deliverables

- first certified financial package flow
- first balance-sheet roll-forward flow
- first open-item report and aging flow
- first in-app reconciliation workflow

### Exit criteria

- users can operate core accounting close/reporting workflows on the new platform layer

## Wave 6: Extensibility Rollout

### Objective

Apply custom fields and custom dimensions to core existing objects.

### First rollout targets

- customers
- vendors
- items
- chart of accounts
- journals
- invoices
- bills

### Exit criteria

- extensibility is real on core objects before broader module expansion

## Recommended Schema Migration Sequence

Use additive migrations in this order:

1. reference catalogs
   - activity types
   - recurring revenue policy/source
   - reporting definition foundations

2. run/integration core tables
   - these support orchestrated backfills and new services

3. open-item and clearing tables

4. FX/intercompany support tables

5. reporting governance tables
   - certification
   - lock state
   - reopen
   - package distribution support

6. reconciliation tables

7. AI governance tables

8. extensibility upgrades / custom dimension tables

9. reporting-serving summary tables

## Dual-Write Strategy

Where feasible, use a staged transition:

1. keep current page/API behavior intact
2. write to old operational structures
3. also write to new canonical support structures
4. validate canonical outputs through reports/admin views
5. progressively shift reads to canonical structures where appropriate

This is especially important for:

- open items
- clearing
- realized FX
- reporting summaries

## Testing and Validation Strategy

Each wave should include:

- schema validation
- service-level unit tests
- regression checks on existing flows
- reporting reconciliation checks
- close/control scenario validation

### Must-have validation scenarios

- partial receipt/payment applications
- reversals and reopenings
- realized FX settlement
- intercompany paired posting
- summary refresh after posting changes
- stale certified output detection
- reconciliation tie-out to open items and GL

## Implementation Roles by Layer

### Backend-first items

- canonical schema
- posting/open-item/clearing services
- FX/intercompany logic
- run/orchestration
- summary refresh engines

### Frontend-first items

- secure package access shell
- compare/diff shell
- certification labels/status UX
- reconciliation workspace shell
- AI review surfaces

### Joint items

- close checklist
- reporting certification/reopen
- recurring-revenue reporting
- package generation and distribution

## Definition of “Phase 1 Complete”

Phase 1 should be considered complete when:

- canonical support tables exist
- shared backend services exist for open item, clearing, FX/intercompany, runs, and reporting refresh
- shared frontend governance shells exist
- core existing accounting flows are retrofitted enough to populate canonical structures
- first reporting/close operator workflows run on the new foundation

## Immediate Next Build Step

Start with a concrete engineering sequence:

1. Prisma migration design for:
   - activity type
   - run tables
   - open item
   - clearing
2. service skeletons for:
   - open-item service
   - clearing service
   - run service
3. retrofit plan for:
   - invoices / receipts / bills / payments / journals

That is the most direct path from architecture into implementation.
