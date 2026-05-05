# Phase 0 FX and Intercompany Schema

## Purpose

This document defines the canonical architecture for:

- exchange-rate context
- multi-currency accounting support
- realized and unrealized FX
- CTA support
- month-end FX processing
- intercompany counterpart and balancing controls
- atomic paired posting for intercompany activity

It builds on:

- [phase-0-architecture-blueprint.md](./phase-0-architecture-blueprint.md)
- [phase-0-canonical-schema.md](./phase-0-canonical-schema.md)
- [phase-0-open-item-schema.md](./phase-0-open-item-schema.md)
- [phase-0-clearing-schema.md](./phase-0-clearing-schema.md)

The goal is to make FX and intercompany first-class accounting engines rather than scattered attributes on transactions.

## Design Goals

1. Support transaction, local, functional, and group currency contexts consistently.
2. Preserve rate lineage used at source, settlement, remeasurement, and consolidation time.
3. Attribute realized FX to the clearing event that caused it.
4. Support unrealized FX and month-end remeasurement runs with full auditability.
5. Support CTA and translation reporting.
6. Enforce intercompany balancing so one side can never post independently.
7. Preserve both operational and ledger traceability.

## Scope

This model applies to:

- all posting-eligible transactions carrying monetary amounts
- clearing events that settle open items across rate contexts
- month-end FX remeasurement and translation processes
- intercompany transactions and their paired postings
- future consolidation and elimination processes

It does not require every downstream module to exist immediately, but the foundation must support them.

## Core Rule

FX and intercompany are not reporting-only concerns.

They are posting and control concerns that must be represented in canonical accounting tables and process runs.

## Canonical Table Families

## 1. `ExchangeRateTable`

### Purpose

Represents one logical rate source or rate family.

Examples:

- corporate spot rates
- month-end closing rates
- average rates
- budget rates
- treasury-provided rates

### Recommended canonical fields

- `id`
- `code`
- `name`
- `rateType`
- `status`
- `provider`
- `baseCurrencyId`
- `quoteConvention`
- `effectiveMethod`
- `createdAt`
- `updatedAt`

### Notes

- `rateType` may distinguish spot, closing, average, budget, or custom rate families.
- `quoteConvention` should preserve whether rates are stored as direct or inverse quotations.

## 2. `ExchangeRate`

### Purpose

Represents one effective exchange rate observation for a currency pair and rate table.

### Recommended canonical fields

- `id`
- `exchangeRateTableId`
- `fromCurrencyId`
- `toCurrencyId`
- `rateDate`
- `rate`
- `inverseRate`
- `sourceBatchId`
- `status`
- `createdAt`
- `updatedAt`

### Notes

- preserve both the rate and enough metadata to reproduce the accounting used
- do not rely on a single mutable “current rate”

## 3. `ExchangeRateBatch`

### Purpose

Tracks nightly or manual FX ingestion activity.

### Recommended canonical fields

- `id`
- `batchNumber`
- `batchType`
- `provider`
- `requestedAt`
- `startedAt`
- `completedAt`
- `status`
- `sourceFileName`
- `message`
- `createdById`

### Typical use cases

- nightly FX rate pulls
- manual treasury uploads
- correction batches

## 4. `ExchangeRateContext`

### Purpose

Represents the exact rate context used for a source transaction, settlement, remeasurement, or translation event.

This is one of the most important canonical records in the FX design.

### Recommended canonical fields

- `id`
- `contextType`
- `exchangeRateTableId`
- `rateDate`
- `fromCurrencyId`
- `toCurrencyId`
- `rate`
- `inverseRate`
- `rateMethod`
- `sourceTransactionType`
- `sourceTransactionId`
- `sourceTransactionLineId`
- `sourceRunId`
- `memo`
- `createdAt`

### Suggested context types

- transaction_entry
- settlement
- remeasurement
- translation
- consolidation
- budget

### Rule

Wherever accounting depends on a rate, preserve the exact rate context used instead of re-deriving it later from a mutable rate table.

## 5. `FxRemeasurementRun`

### Purpose

Represents a month-end or ad hoc unrealized FX process run.

### Recommended canonical fields

- `id`
- `runNumber`
- `status`
- `asOfDate`
- `accountingPeriodId`
- `subsidiaryScope`
- `currencyScope`
- `exchangeRateTableId`
- `startedAt`
- `completedAt`
- `message`
- `createdById`

## 6. `FxRemeasurementLine`

### Purpose

Represents one remeasured balance or open-item result inside a remeasurement run.

### Recommended canonical fields

- `id`
- `fxRemeasurementRunId`
- `lineNumber`
- `sourceType`
- `sourceId`
- `accountId`
- `subsidiaryId`
- `transactionCurrencyId`
- `localCurrencyId`
- `functionalCurrencyId`
- `priorFunctionalAmount`
- `remeasuredFunctionalAmount`
- `unrealizedFxFunctionalAmount`
- `exchangeRateContextId`
- `glHeaderId`
- `glLineId`
- `createdAt`

## 7. `TranslationRun`

### Purpose

Represents period-end translation and CTA generation.

### Recommended canonical fields

- `id`
- `runNumber`
- `status`
- `asOfDate`
- `accountingPeriodId`
- `rateTableSetId`
- `startedAt`
- `completedAt`
- `message`
- `createdById`

## 8. `TranslationLine`

### Purpose

Represents one translated balance movement inside a translation run.

### Recommended canonical fields

- `id`
- `translationRunId`
- `lineNumber`
- `subsidiaryId`
- `accountId`
- `sourceCurrencyId`
- `targetCurrencyId`
- `priorTranslatedAmount`
- `translatedAmount`
- `ctaAmount`
- `exchangeRateContextId`
- `glHeaderId`
- `glLineId`
- `createdAt`

## 9. `IntercompanyRelationship`

### Purpose

Represents a governed intercompany relationship between two legal entities / subsidiaries.

### Recommended canonical fields

- `id`
- `fromSubsidiaryId`
- `toSubsidiaryId`
- `status`
- `dueToAccountId`
- `dueFromAccountId`
- `settlementAccountId`
- `defaultCurrencyId`
- `requiresBalancedPosting`
- `createdAt`
- `updatedAt`

## 10. `IntercompanyPairing`

### Purpose

Represents the paired relationship between two intercompany transaction or GL sides.

### Recommended canonical fields

- `id`
- `pairingNumber`
- `pairingType`
- `status`
- `leftTransactionType`
- `leftTransactionId`
- `rightTransactionType`
- `rightTransactionId`
- `leftGlHeaderId`
- `rightGlHeaderId`
- `leftGlLineId`
- `rightGlLineId`
- `balanceStatus`
- `postedAtomically`
- `reversalPairingId`
- `createdAt`
- `updatedAt`

### Rule

One side of an intercompany event must never be considered posted independently of the other.

## 11. `IntercompanySettlementRun`

### Purpose

Represents a run that settles due-to / due-from balances or generates balancing activity.

### Recommended canonical fields

- `id`
- `runNumber`
- `status`
- `asOfDate`
- `relationshipScope`
- `startedAt`
- `completedAt`
- `message`
- `createdById`

## Currency Model Expectations

Accounting-relevant records should preserve, where applicable:

- transaction currency
- local currency
- functional currency
- group currency

and amounts in those contexts as required by the business object or posting layer.

### Rule

Do not assume:

- local and functional currency are always the same
- functional and group currency are always the same
- every entity shares the same functional currency

### Currency-role interpretation

- `transaction currency`
  currency the transaction is entered or settled in
- `local currency`
  statutory / company-code / legal-book currency
- `functional currency`
  primary economic-environment currency of the entity
- `group currency`
  consolidated reporting currency used for enterprise reporting and CTA

## Realized FX Principle

Realized FX should arise from clearing/settlement.

### Canonical expectation

- source open item retains original rate context
- settlement carries settlement rate context
- clearing document line references both
- resulting realized FX is posted and attributable to the clearing event

### Supported outputs

- realized gain/loss at transaction, clearing, and GL levels
- customer/vendor settlement FX drill-through
- audit trace from GL back to clearing and source transaction

## Unrealized FX Principle

Unrealized FX should be generated through controlled remeasurement runs, not ad hoc manual recalculation.

### Canonical expectation

- remeasurement run identifies balances/open items requiring remeasurement
- run creates line-level results
- run creates or links resulting GL postings
- history remains reconstructable by run and as-of date

## CTA Principle

CTA should be supported as a translation-layer outcome, not approximated from transactional FX alone.

### Canonical expectation

- translation run produces line-level translation deltas
- CTA is preserved as its own attributable output
- translation results can be reported by subsidiary, account, and period

## Intercompany Control Principle

Intercompany postings must be balanced and atomic.

### Required behavior

- validate both sides before posting
- post both sides together
- if either side fails, neither side posts
- preserve pairing references for all counterpart lines
- support reversal only as paired reversal

### Reporting expectations

- out-of-balance exception reporting
- unmatched / unpaired intercompany exception reporting
- due-to / due-from aging and settlement reporting

## Relationship to GL

FX and intercompany should be visible in GL through:

- `exchangeRateContextId` references on GL lines where relevant
- activity types such as:
  - fx_remeasurement
  - realized_fx
  - translation
  - cta
  - intercompany_settlement
  - intercompany_reclass
- intercompany pairing references on GL headers / lines where relevant

## Relationship to Runs

FX and intercompany should be run-aware.

Run families that should tie into this schema include:

- nightly FX ingestion
- month-end FX remeasurement
- translation / CTA
- intercompany settlement
- bank matching where settlement drives FX recognition

## Reporting Expectations

The model should support:

- realized FX reporting
- unrealized FX reporting
- CTA reporting
- as-of FX remeasurement reporting
- intercompany balance and exception reporting
- drill-through from GL to rate context and run

## Indexing Guidance

### `ExchangeRate`

Consider indexes on:

- `id`
- `exchangeRateTableId`
- `fromCurrencyId`, `toCurrencyId`
- `rateDate`
- `status`

### `ExchangeRateContext`

Consider indexes on:

- `id`
- `contextType`
- `rateDate`
- `exchangeRateTableId`
- `sourceTransactionType`, `sourceTransactionId`
- `sourceRunId`

### `FxRemeasurementLine`

Consider indexes on:

- `id`
- `fxRemeasurementRunId`
- `accountId`
- `subsidiaryId`
- `sourceType`, `sourceId`
- `exchangeRateContextId`

### `IntercompanyPairing`

Consider indexes on:

- `id`
- `pairingNumber`
- `status`
- `leftTransactionId`
- `rightTransactionId`
- `leftGlHeaderId`
- `rightGlHeaderId`
- `balanceStatus`

## Frontend Contract

The shared frontend should expose:

- rate context visibility on transactions and settlement details
- FX process run pages
- translation / CTA run pages
- intercompany pairing visibility on transactions and GL detail
- out-of-balance / exception queues
- drill-through from reports to runs, pairings, and GL

## Retrofit Guidance for Current App

The current app already has:

- currencies
- exchange rates
- intercompany journals

These should evolve toward the canonical design by:

1. preserving existing operational pages first
2. introducing exchange-rate context records for actual accounting usage
3. introducing run-driven remeasurement/translation records
4. introducing atomic intercompany pairing instead of one-sided posting logic
5. linking realized FX to clearing and GL rather than only to derived totals

## Immediate Next Tasks

1. define canonical run / batch / integration tables
2. define migration approach for current exchange-rate and intercompany structures
3. define canonical GL activity-type catalog
4. define month-end process orchestration sequence across FX, open items, and close
