# Enterprise Foundation Build Sheet

## Purpose

This document defines the phased enterprise-grade expansion plan for the app.

It is intentionally full-stack:

- backend schema and posting engines
- frontend shared page contracts
- retrofit scope for existing pages
- dependency order for new modules

The goal is to avoid adding more one-off pages before the platform foundation is strong enough to support:

- custom fields
- custom dimensions
- open item management
- historical open item reporting
- balance sheet roll-forwards
- run-based accounting operations
- deep financial and management reporting
- interactive close / accounting checklist workflows
- planning and forecasting engines
- treasury cash management controls
- bank connectivity and statement ingestion
- AP automation and approval workflow
- enterprise multi-currency accounting controls
- intercompany balancing controls
- enterprise integration platform capabilities
- governance, security, and audit controls
- workflow and automation platform capabilities
- shared saved-search behavior
- consistent list/detail/customize/GL/related-record patterns

## Core Rule

Every new module must be modeled as a real ERP object, not just a page.

That means every module must be classified up front as one of:

1. Setup / master record
2. Transaction header + lines
3. Transaction header + allocations / applications
4. Schedule header + schedule lines
5. Mapping / junction / assignment model

And every module must explicitly decide:

- `DB Id`
- `Business Id`
- `Description`
- optional domain number / code or external reference where applicable
- status lifecycle
- posting behavior
- source / target links
- dimension support
- custom field support
- custom dimension support
- permissions hooks
- saved-search exposure
- import / export support
- related records / related documents / communications / system notes

## Shared UI Contracts

Every applicable page should reuse these patterns.

### Shared list engine rule

All new list pages must be implemented on the shared list-page and saved-search engine.

That includes:

- shared toolbar
- page saved-search selector
- saved-search editor entry
- shared live column definition
- joined-field column support
- shared export integration
- shared filter/search behavior

No new hard-coded one-off list page patterns should be introduced.

Existing pages that are still on older list implementations should be migrated during the retrofit phase before parallel list paradigms are allowed to expand further.

### List pages

- shared toolbar
- page saved-search selector
- saved-search editor entry
- export
- consistent live column contract
- consistent joined-field support

### Detail pages

- shared detail frame
- related records
- related documents
- communications
- system notes
- GL impact where applicable
- status / posting locks where applicable

### Record identity rule

Every master-data record and every transaction record should carry:

- `DB Id`
- `Business Id`
- `Description`

`Business Id` should follow Company Preferences / id-settings behavior where that record family is numbered.

Master-data families may also carry an additional domain-specific number / code.

Transaction families may also carry an additional external or domain-specific reference.

The display rule should be:

- detail pages show all identity fields when they exist
- master-data lists and dropdowns prefer:
  - number / code + description
  - otherwise business id + description
- transaction lists and dropdowns prefer:
  - external / domain reference + description where that is the working identifier
  - otherwise business id + description

`DB Id` is the true system identifier and should not be the normal user-facing selector value.

This rule should be reflected consistently in:

- schema design
- create/edit flows
- detail pages
- customize layouts
- list pages
- import/export contracts

### Edit / create pages

- shared list field sourcing model
- shared header details rendering
- shared line container or allocation container where applicable

### Customize pages

- reference layout
- detail layout
- line columns layout where applicable
- GL impact layout where applicable

### Platform administration surfaces

The enterprise platform should also expect shared administration surfaces for:

- integration management
- workflow / automation management
- job / run monitoring
- audit and exception review
- metadata and configuration deployment

## Data Modeling Standard

### Transaction posting context rule

Every transaction document must carry both:

- `subsidiaryId`
- transaction `currencyId`

This is a hard platform rule for posted and posting-capable transactions. We do not have consolidation-grade accounting without explicit legal-entity and transaction-currency context on the transaction itself.

This applies across the full transaction chain, including but not limited to:

- `Opportunity`
- `Quote`
- `Sales Order`
- `Fulfillment`
- `Invoice`
- `Invoice Receipt`
- `Credit Memo`
- `Customer Refund`
- `Purchase Requisition`
- `Purchase Order`
- `Receipt`
- `Bill`
- `Bill Payment`
- `Bill Credit`
- `Vendor Refund`
- `Journal Entry`
- `Intercompany Journal`
- `Clearing Document`
- `Open Item`

Inheritance should flow downstream where applicable:

- `Opportunity -> Quote -> Sales Order -> Invoice -> Invoice Receipt`
- `Purchase Requisition -> Purchase Order -> Receipt -> Bill -> Bill Payment`

Implementation rules:

- the transaction header must store both fields directly
- downstream documents may derive them from the upstream source, but the derived values must still be persisted on the transaction
- create/update APIs must validate and preserve a single posting context
- shared customize pages must show these fields as required, checked, and locked/greyed out
- transaction detail pages must expose them as first-class transaction fields, not hidden inferred context

### Core ledger and transaction storage requirement

The platform should standardize on:

- transaction header tables
- transaction line tables
- GL header tables
- GL line tables

for all accounting-relevant flows where that pattern applies.

This is required so that:

- operational transactions remain distinct from accounting postings
- posting can be traced from source transaction to GL
- subledger and general ledger drill-through stays consistent
- reporting and auditability remain performant at scale

### Indexing and performance rule

All core transactional and GL tables must be indexed deliberately for enterprise reporting and posting performance.

At minimum, indexing strategy should consider:

- record id
- business transaction number
- status
- transaction date / posting date
- subsidiary
- currency
- source transaction linkage
- account
- customer / vendor / employee / project / location / department / class
- open-item linkage
- intercompany linkage
- run / batch linkage

Indexing should be treated as part of the model design, not a later optimization pass.

### Base record requirements

Most enterprise records should consider these fields:

- `id`
- business identifier such as `number`, `code`, or `recordId`
- `status`
- `subsidiaryId`
- `currencyId` where relevant
- `transactionCurrencyId`, `localCurrencyId`, `functionalCurrencyId`, and `groupCurrencyId` where relevant
- `createdAt`
- `updatedAt`
- `createdBy`
- `updatedBy`
- `approvedBy` where relevant
- `postedBy` where relevant
- `memo` / `reference` / `notes` where relevant

### Multi-currency transaction requirement

Currency-aware transactions should not rely on a single currency field.

The accounting foundation should support four currency contexts where relevant:

- `transaction currency`
- `local currency`
- `functional currency`
- `group currency`

Interpretation:

- `transaction currency`
  entry or settlement currency of the business event
- `local currency`
  statutory / company-code / legal-book currency of the entity
- `functional currency`
  primary economic-environment currency of the entity
- `group currency`
  consolidated reporting currency used across the enterprise

This is required for:

- transaction entry and display
- subledger calculations
- ledger posting
- realized gains and losses
- unrealized gains and losses
- CTA
- local and consolidated reporting

### FX accounting requirements

The platform should support:

- nightly FX rate ingestion
- historical rates
- average rates
- current / closing rates
- historical rates for equity and other historical-basis cases
- realized FX calculations
- unrealized FX remeasurement
- CTA handling
- month-end FX process runs
- FX rate auditability

### Transaction-by-transaction 4-currency recommendation

To keep the Phase 0 rollout disciplined, transaction families should be prioritized by accounting impact rather than upgraded uniformly.

#### Highest-priority transaction families

- `Invoices`
  - require full transaction / local / functional / group currency ids
  - require posted amount context in each bucket when truly known
  - open customer open items and therefore anchor later realized FX
- `Bills`
  - require full transaction / local / functional / group currency ids
  - require posted amount context in each bucket when truly known
  - open vendor open items and therefore anchor later realized FX
- `Invoice Receipts`
  - require full 4-currency settlement context
  - should drive realized FX against invoices where rates differ
- `Bill Payments`
  - require full 4-currency settlement context
  - should drive realized FX against bills where rates differ
- `Journals`
  - require strong 4-currency support wherever they create monetary/open-item effects
- `Intercompany Journals`
  - should be treated as one of the strongest 4-currency families because consolidation and intercompany balancing depend on them

#### Next priority

- `Customer Refunds`
  - full 4-currency settlement context
- `Clearing Documents`
  - full 4-currency settlement context
  - readable FX and settlement lineage even before every GL edge case is complete

#### Medium priority

- `Sales Orders`
  - useful 4-currency reporting context
  - lower priority than invoices
- `Purchase Orders`
  - useful 4-currency reporting context
  - lower priority than bills
- `Receipts`
  - medium priority where value-bearing inventory/accounting logic depends on them
- `Fulfillments`
  - medium-to-lower priority unless value-bearing posting depends on them

#### Lower Phase 0 priority

- `Quotes`
  - transaction currency matters
  - full translated amount handling can come later
- `Purchase Requisitions`
  - transaction/reporting context matters
  - full translated amount handling can come later

#### Non-negotiable implementation rule

- If the system does not actually know a translated local, functional, or group amount yet, that bucket should remain null.
- The platform must not fake multi-currency completeness by copying transaction amounts into the other currency columns.

### Line-bearing transactions

If a process has repeatable economic detail, it should have a dedicated line table instead of JSON or ad hoc arrays.

Examples:

- `ExpenseReport` + `ExpenseReportLine`
- `Deposit` + `DepositLine`
- `BillingSchedule` + `BillingScheduleLine`
- `RevenueRecognitionSchedule` + `RevenueRecognitionScheduleLine`
- `AmortizationSchedule` + `AmortizationScheduleLine`

### Allocation / application transactions

If a process settles or distributes balances, it should have a dedicated application table.

Examples:

- `InvoiceReceiptApplication`
- `BillPaymentApplication`
- future `CustomerRefundApplication`
- future open-item settlement links

### Schedule-driven accounting

If a process creates dated accounting recognition, it should have:

- schedule header
- schedule lines
- posting linkage
- source linkage

Examples:

- revenue recognition
- amortization

### GL posting pattern

Accounting postings should be modeled with dedicated GL structures, not mixed directly into operational transaction tables.

Expected core pattern:

- `GlHeader`
- `GlLine`

With traceability back to:

- source transaction header
- source transaction line where applicable
- posting run / batch where applicable
- currency/rate context
- activity type
- intercompany counterpart context

### Integration and automation rule

External integration, workflow automation, and batch/run execution should be treated as first-class platform capabilities, not one-off utility pages.

That includes:

- integration definitions
- credentials / auth models
- inbound/outbound message tracking
- webhook/event subscriptions
- scheduled jobs
- retry / failure handling
- execution audit logs

### AI enablement rule

AI should be embedded as a controllable platform capability across the entire app, not bolted on as isolated features.

Every AI-enabled experience should be able to be:

- enabled or disabled globally
- enabled or disabled by module
- enabled or disabled by process family
- enabled or disabled by specific process step
- enabled or disabled by tenant / environment
- enabled or disabled by role where appropriate

AI should support, where relevant, across all app areas:

- reconciliations and bank-match suggestions
- variance analysis
- close assistance
- AP OCR and coding suggestions
- anomaly detection
- exception triage
- narrative reporting assistance
- KPI and management-package commentary
- workflow guidance and next-best-action suggestions

This includes, where applicable:

- master data maintenance
- list and saved-search experiences
- transaction entry and review
- posting and settlement workflows
- reporting and analytics
- treasury and bank operations
- AP and AR automation
- integration and exception handling
- close operations
- planning and forecasting
- administrative and configuration surfaces

### AI control non-negotiables

- AI suggestions must be traceable
- AI-generated outputs must distinguish suggestion vs execution
- human override must always be available where accounting control matters
- AI should be able to participate at every step, but never be impossible to turn off

## Phase 0: Foundation Design

### Objective

Lock the enterprise-grade backend and frontend contracts before more modules are added.

### Deliverables

- schema blueprint for custom fields
- schema blueprint for custom dimensions
- schema blueprint for open item engine
- schema blueprint for roll-forward engine
- schema blueprint for multi-currency / FX accounting
- schema blueprint for intercompany balancing controls
- schema blueprint for transaction header/line and GL header/line architecture
- schema blueprint for integration, workflow, and job/run platform services
- retrofit map for existing pages
- shared component matrix

### Exit criteria

- no new major module starts before this blueprint is accepted
- new modeling checklist is agreed and reused

## Phase 1: Platform Extensibility Core

### Objective

Add a reusable custom field and custom dimension foundation.

### Backend targets

#### Custom fields

- `CustomFieldDefinition`
- `CustomFieldAssignment`
- `CustomFieldOption`
- `CustomFieldValue`
- optional sourcing/default tables if needed

#### Custom dimensions

- `CustomDimensionDefinition`
- `CustomDimensionValue`
- `CustomDimensionAssignment`
- optional dimension-group / reporting metadata

### Frontend targets

- shared rendering for header fields
- shared rendering for line fields
- detail/edit/create support
- customize-page support
- saved-search field exposure
- export support

### Retrofit scope

- current master data pages
- current transaction headers
- current line sections
- customize framework
- saved-search metadata model

### Exit criteria

- new fields can be assigned without page-specific hacks
- custom dimensions are available for later posting/reporting work

## Phase 2: Open Item + Roll-Forward Accounting Core

### Objective

Build an accounting engine that supports both current and historical open-item reporting.

### Critical rule

Open item management must be event-driven and reconstructable.

Do not rely only on mutable “current open balance” fields.

### Backend targets

- `OpenItem`
- `OpenItemEntry`
- `OpenItemApplication`
- optional `OpenItemSnapshot` later for performance only
- FX rate / FX process models
- intercompany balancing / pairing models

### Event examples

- item created
- item applied
- item reversed
- item written off
- item reopened
- item adjusted

### Historical reporting requirements

Must support:

- open items as of a date
- applied after date
- aging as of a date
- settlement history
- reopened item history
- drill-through from balance to source/application events

### Roll-forward foundation

Add account and movement metadata needed for:

- opening balance
- period activity
- closing balance
- movement category mapping
- dimension-aware grouping
- transaction activity typing for roll-forward classification

Reconciliations should integrate directly with this roll-forward foundation and should be performed natively in-app, driven largely by:

- open-item management
- clearing and settlement lineage
- AI-assisted matching and exception handling

Important boundary for current scope:

- do not force the future account-reconciliation workbench into the Phase 0 clearing-document entry page
- keep Phase 0 focused on:
  - unified clearing-document tables
  - open-item application lifecycle
  - readable system-generated clearing detail pages
  - manual clearing as a structural exception path
- plan the richer account-reconciliation workbench for a later phase where it can properly support:
  - GL-account-driven filtering
  - custom-dimension filtering
  - debit / credit selection panes
  - balancing checks
  - reconciliation-oriented exception handling

That later workbench should create or feed clearing documents rather than introduce a separate clearing backend.

Journal adjustments and journal reversals should be modeled and posted in a way that makes accounts easy to reconcile.

Where journals are used for open-item-eligible activity, they should participate cleanly in:

- open-item management
- reversal lineage
- balance-sheet reconciliations
- roll-forward drill-through

### Roll-forward activity typing requirement

Balance sheet roll-forwards must not depend only on account number and source transaction labels.

The accounting engine should classify posted activity with explicit activity typing such as:

- opening balance
- operational movement
- settlement / application
- accrual
- deferral
- amortization
- revenue recognition
- reclassification
- FX remeasurement
- transfer
- write-off
- reversal
- close / carry-forward

This activity typing should be available for:

- journal lines
- subledger-originated posting lines
- roll-forward reporting
- drill-through reporting

### Multi-currency and intercompany foundation

The accounting foundation should also define:

- transaction-currency storage
- local-currency storage
- functional-currency storage
- translated posting amounts
- FX source rate references
- remeasurement links
- CTA classification rules
- intercompany counterpart linkage
- balancing validation rules

### Frontend targets

- visible open-item applications on existing transaction pages
- historical open-item reporting pages
- roll-forward reporting pages
- reporting drill-through pages
- drill-through to source transaction and GL
- month-end FX run visibility
- intercompany counterpart and balance visibility

### Exit criteria

- current and historical open-item state can be reported accurately
- roll-forward data model is strong enough for future RTR modules
- multi-currency foundation is strong enough for realized / unrealized / CTA processing
- intercompany transactions cannot post one side without the other

## Phase 3: Retrofit Existing Pages

### Objective

Upgrade current pages to the new extensibility and accounting foundation before adding more modules.

### Priority retrofit targets

#### Accounting core

- `chart-of-accounts`
- `journals`
- `currencies`
- `exchange-rates`
- `intercompany-journals`

#### Open-item relevant transactions

- `invoices`
- `bills`
- `invoice-receipts`
- `bill-payments`
- `customer-refunds`

#### Revenue / schedule readiness

- `items`

#### Platform support

- saved-search engine
- customize framework
- exports
- permissions hooks

### Retrofit expectations

- custom fields render consistently
- custom dimensions render consistently
- posting logic carries dimensions
- open-item links are visible where relevant
- saved searches can see extensible fields
- currency context is explicit and consistent
- intercompany transactions enforce balanced dual-sided posting

### Exit criteria

- current app no longer depends on hard-coded assumptions for extensibility

## Phase 4: Treasury

### Objective

Build the missing cash-management foundation.

### Modules

- `Bank Accounts`
- `Deposits`
- `Checks`
- `Bank Transfers`
- `Bank Reconciliation`
- `Bank Matching`
- `Cash Management`
- `Cash Flow Forecasting`
- `Bank Connectivity`
- `Statement Imports`
- `Deposit Invoicing`

### Modeling expectations

- bank accounts as first-class records
- deposits with line/application support as needed
- checks with payee/application support as needed
- reconciliation linkage to source cash movements
- bank matching engine with imported statement lines, candidate matches, match rules, and match/audit actions
- treasury cash positioning, liquidity visibility, and forecast inputs across bank, AR, AP, subscriptions, billing, and planned spend
- bank connectivity layer for statement/activity ingestion from financial institutions
- deposit invoicing support where deposits themselves can become billable/invoiceable business events

### Bank connectivity expectations

Support should be designed for:

- bank connection records
- institution metadata
- account linkage
- statement import batches
- statement lines / external bank activity
- duplicate detection
- auto-match rules
- manual match / split / unmatch actions
- match audit history

## Phase 5: Foundation Master / Setup Records

### Modules

- `Projects`
- `Classes`
- `Tax Codes`
- `Payment Terms`
- `Units of Measure`
- `Price Books` / `Price Levels`
- `Customer Categories`
- `Vendor Categories`
- `Expense Categories`

### Additions

- inventory foundations where required for later inventory modules

### Notes

These should still support shared list/detail/customize/saved-search patterns, even if they are not GL-posting records.

## Phase 5A: Platform and Integration Services

### Modules

- `Integration Management`
- `SOAP Web Services`
- `REST Web Services`
- `Webhooks / Event Subscriptions`
- `Scheduled Jobs / Orchestration`
- `API Keys / OAuth / Service Accounts`
- `Integration Audit Logs`
- `Retry / Dead-Letter / Failure Queue`
- `File-Based Imports / Exports`
- `EDI`

### Notes

This phase should provide the operational platform layer for:

- external system connectivity
- inbound / outbound integration monitoring
- service credentials and endpoint management
- job scheduling and retry handling
- auditability of integration activity

## Phase 6: Lead to Cash Expansion

### Modules

- `Credit Memos`
- `Subscriptions`
- `Billing Schedules`
- `Usages`
- `Usage-Based Billing`
- `Billing Runs`
- `Return Authorizations`
- optional `Cash Sales`

### Notes

Subscriptions, billing schedules, and usages should be modeled as real line/schedule-capable records, not shallow admin pages.

Usage-based billing should be modeled as a real operational billing layer, not only as raw usage rows.

That means support for:

- usage capture
- billable usage qualification
- usage rating / pricing
- invoiceable usage staging
- generated billing transactions
- rerating / adjustment strategy
- audit trail

Billing runs should be modeled as operational batch records with:

- run header
- run candidates
- generated transaction links
- rerun / reversal / failure handling
- audit trail

### SaaS and recurring revenue reporting requirement

The LTC and reporting foundation must support both:

- subscription revenue models
- non-subscription revenue models

including hybrid environments where both coexist.

It must also support usage-based billing analytics and recurring-revenue reporting such as:

- MRR
- ARR
- monthly MRR roll-forward
- annual MRR roll-forward
- new MRR
- expansion MRR
- contraction MRR
- churned MRR
- reactivation MRR
- committed vs billed recurring revenue
- subscription vs non-subscription revenue splits
- usage-based billed revenue and usage-backed expansion analytics

These should be modeled as first-class reporting and analytics outputs, not spreadsheet-only calculations.

## Phase 7: Procure to Pay Expansion

### Modules

- `Expense Reports`
- `Expense Reimbursements`
- `Vendor Credits`
- `Purchase Contracts` / `Blanket POs`
- `Landed Costs`
- `Payment Runs`
- `AP Portal`
- `AP Inbox Capture`
- `OCR and Auto Coding`
- `Email Approval Workflow`

### Notes

Expense Reports should be a true header + line transaction and should be designed for approval and posting extension later.

Expense reimbursements should be modeled as their own payable/settlement flow, not only as an implicit side effect of expense reports.

That means support for:

- reimbursement header
- reimbursable expense selection
- employee payable settlement
- reimbursement payment linkage
- audit trail

Payment runs should be modeled as operational batch records with:

- run header
- selected payable items
- payment outputs
- exceptions
- approval / release state
- audit trail

### AP automation expectations

The AP automation layer should support:

- AP email inbox connection / ingestion
- vendor bill capture from email
- attachment storage
- OCR extraction
- confidence scoring
- suggested vendor / amount / date / invoice number detection
- suggested account / department / dimension coding
- duplicate invoice detection
- human review queue
- email approval workflow
- posting to bills / approvals / payment readiness

This should be treated as an operational subledger workflow, not just a document upload page.

## Phase 8: Record to Report Expansion

### Modules

- `Revenue Recognition Rules`
- `Revenue Recognition Schedules`
- `Revenue Recognition Journal Runs`
- `Amortization Templates`
- `Amortization Schedules`
- `Amortization Runs`
- `Fixed Assets`
- `Inventory`
- `Budgets`
- `Planning`
- `3-Year Operational Planning`
- `Allocations`
- `FMV Allocation`
- `Recurring Journals`
- `Statistical Accounts`
- `Month-End FX Process Runs`
- `Deferred Waterfall Reporting`
- `Consolidation`
- `Eliminations`
- `Multi-Book Accounting`
- `Tax Engine`
- `Close Manager`
- `Reconciliation Manager`
- `Journal Approval Workflow`
- `Accrual Engine`
- `Prepaid / Deferred Expense Automation`

### Modeling split

#### Rules / templates

Setup-style records:

- `RevenueRecognitionRule`
- `AmortizationTemplate`

#### Schedules

Transaction-like records:

- `RevenueRecognitionSchedule`
- `RevenueRecognitionScheduleLine`
- `AmortizationSchedule`
- `AmortizationScheduleLine`

### Notes

These should use:

- shared detail frame
- schedule line section
- GL impact
- related source links
- communications
- system notes

Run-style accounting operations should be modeled as first-class operational records:

- `RevenueRecognitionJournalRun`
- `AmortizationRun`
- `MonthEndFxProcessRun`

with:

- run header
- scope / selection criteria
- generated journal links
- error / exception rows
- rerun / reversal strategy
- audit history

### Multi-currency / intercompany expectations

The accounting engine should support:

- nightly FX rate pulls
- rate audit history
- period-end remeasurement runs
- CTA generation where required
- realized gain/loss calculation on settlement
- unrealized gain/loss calculation at remeasurement
- intercompany transaction pairing
- automatic validation that intercompany postings remain in balance
- atomic posting of both intercompany sides so one side can never post alone

### Advanced finance-core expectations

The accounting platform should also support:

- consolidation across subsidiaries/entities
- elimination entries and elimination workflows
- multi-book accounting where required
- tax engine support for indirect tax / transaction tax requirements
- close management and reconciliation workflows
- journal approval controls
- accrual automation
- prepaid / deferred expense automation

Fixed assets and inventory should be treated as major module families, not single pages.

Budgets and planning should be treated as their own planning family, not as a single static budget table.

### Planning and budgeting family

- budget versions
- budget scenarios
- operating plans
- driver-based planning inputs
- workforce / expense / revenue planning inputs
- multi-year planning horizons
- plan approvals / locks
- actual vs budget vs forecast reporting

### FMV allocation expectations

The accounting engine should support fair market value allocation capabilities where transactions require multi-element allocation logic.

That should support:

- allocation rules / methodologies
- source obligation identification
- relative standalone value / FMV inputs
- allocation result storage
- linkage to downstream revenue recognition schedules
- audit trail of allocation assumptions and outputs

### Cash management / forecasting family

- cash positions by bank / subsidiary / currency
- forecast buckets
- forecast assumptions
- inflow and outflow source mapping
- forecast versions / scenarios
- actual vs forecast comparison
- liquidity reporting

### Fixed Assets module family

- asset records
- asset categories
- depreciation methods
- depreciation books
- asset transfers
- asset disposals
- asset depreciation runs

### Inventory module family

- inventory items / item attributes
- inventory balances by location / subsidiary
- inventory adjustments
- inventory transfers
- inventory counts / cycle counts
- inventory costing support
- inventory valuation reporting
- lot / serial control
- bin management
- demand planning
- replenishment / MRP
- manufacturing / BOM / work orders where required

## Phase 9: Close Operations and Guided Accounting Workflow

### Objective

Provide an interactive accounting checklist that operational users must complete as part of period-end and control processes.

### Modules

- `Accounting Checklists`
- `Checklist Templates`
- `Checklist Tasks`
- `Checklist Task Assignments`
- `Checklist Evidence / Notes`

### Notes

This should support:

- period-end checklists
- treasury checklists
- AP / AR control checklists
- required completion / sign-off
- dependencies between tasks
- linked reports and linked source transactions
- audit trail of who completed what and when

## Phase 9A: Workflow, Automation, and Governance Platform

### Modules

- `Workflow Builder`
- `Approval Matrix / Delegation of Authority`
- `Task / Workflow Engine`
- `Notification Center`
- `Exception Management Queue`
- `Custom Forms`
- `Custom Records`
- `Script / Automation Framework`
- `Metadata Package Management`
- `Sandbox / Release Management`

### Notes

This phase should provide the configurable platform layer for:

- workflow automation
- approval routing
- metadata-driven extensions
- scripted/business automation
- environment-safe promotion and release controls

## Phase 10: Deep Reporting Layer

### Objective

Provide enterprise-grade financial and management reporting with drill-through.

### Reporting families

- complete financial package
- balance sheet
- income statement
- cash flow
- cash forecast
- trial balance
- balance sheet roll-forwards
- open item reports
- AR aging
- AP aging
- bank reconciliation / matching reports
- revenue recognition reports
- amortization reports
- fixed asset reports
- inventory valuation and movement reports
- management reporting by subsidiary, department, location, project, class, and custom dimensions
- budget vs actual reporting
- forecast vs actual reporting
- multi-year operating plan reporting
- realized FX reporting
- unrealized FX reporting
- CTA reporting
- intercompany out-of-balance exception reporting
- deferred waterfall reporting
- SaaS metrics reporting
- monthly MRR reporting
- annual MRR reporting
- MRR roll-forward reporting
- subscription vs non-subscription revenue reporting
- usage-based billing analytics
- report builder
- semantic metrics layer
- snapshot reporting
- benchmark / peer comparison
- narrative reporting
- scheduled report bursting

### Financial package expectations

The reporting layer should support generating a complete financial package at the press of a button, including:

- core financial statements
- KPI package
- variance package
- roll-forwards
- supporting schedules
- board / management package outputs

### KPI and dashboard expectations

The platform should support configurable KPI dashboards, including SaaS metrics where relevant.

Examples:

- revenue
- gross profit
- net income
- operating cash flow
- bank balance
- inventory value
- new customers
- receivables turnover
- DSO
- inventory turnover
- days inventory on hand
- current ratio
- return on assets
- debt to assets
- debt to equity
- equity ratio
- return on equity
- SaaS metrics such as ARR, MRR, churn, CAC, LTV, NRR, GRR, logo churn, revenue churn, expansion revenue, contraction revenue, reactivation revenue, ARPA / ARPU, payback, quick ratio, burn multiple, magic number

### SaaS reporting expectations

The platform should explicitly support:

- monthly MRR reporting
- annual MRR reporting
- MRR roll-forward reporting
- ARR roll-forward reporting where relevant
- subscription vs non-subscription revenue analysis
- usage-based billing analytics
- customer-level and cohort-level recurring revenue analysis
- drill-through from recurring revenue metrics to subscriptions, billing schedules, usage, invoices, and revenue-recognition outputs

Dashboards should support:

- configurable KPI definitions
- time-period comparisons
- period, quarter, and fiscal-year views
- drill-through to source records
- role-aware access
- saved dashboard views

### Reporting platform expectations

The reporting platform should also support:

- self-service report builder
- advanced pivot-style dimensional reporting
- shared semantic metrics definitions
- scheduled report generation and bursting
- snapshot-based historical reporting where needed
- narrative and management-package output

### Native in-app reporting requirement

The platform should provide its reporting, pivot, dashboard, financial package, and management deck capabilities natively in-app.

The design target is to avoid dependency on third-party BI tools such as Power BI, MicroStrategy, or similar products for core enterprise reporting needs.

External BI connectivity may still be supported as an integration capability, but the in-app reporting layer should be strong enough to stand on its own for:

- financial reporting
- management reporting
- dimensional pivots
- board and executive packages
- SaaS metrics
- close reporting
- drill-through analytics

### Reporting performance requirement

The reporting architecture should include indexed summary GL structures for fast, scalable financial and management reporting.

These summary structures should support:

- period-based financial reporting
- dimensional reporting
- roll-forward reporting
- KPI and dashboard queries
- drill-to-detail from summary to underlying GL and source transactions

They should be treated as governed reporting-layer structures, not ad hoc caches.

### Presentation-quality reporting requirement

The platform should support a professional reporting and deck-building layer capable of producing:

- highly presentable financial packages
- board-ready management decks
- dimensional pivot-style reporting
- schedule-based supporting reports
- narrative-enhanced reporting outputs

This should support strong layout control, reusable templates, and dimensional pivots across subsidiary, department, location, class, project, custom dimensions, and recurring-revenue dimensions where applicable.

### AI analytics and close expectations

The platform should support AI-assisted analytics and close workflows, including:

- variance explanation assistance
- anomaly detection
- close risk identification
- suggested reconciliation or review focus areas
- recommended accruals for expected vendor bills not yet received
- draft accrual/reversal journal patterns for recurring vendor expense cycles
- KPI narrative generation
- close task assistance

## Phase 11: Security, Identity, and Compliance

### Modules

- `Field-Level Security`
- `Role Templates and Advanced Permission Scopes`
- `SSO / SAML`
- `SCIM`
- `Data Retention / Legal Hold`
- `Privacy / Data Governance Tooling`
- `Document Management / File Cabinet`
- `Attachment OCR / Search`

### Notes

This phase should harden enterprise controls around:

- user and identity lifecycle
- fine-grained access control
- regulated data handling
- enterprise document retention and searchability

## Phase 12: Supply Chain and Procurement Extensions

### Modules

- `Supplier Onboarding`
- `Vendor Self-Service Portal`
- `Procurement Approvals`
- `Corporate Card / Expense Card Feeds`
- `Travel / Mileage / Per Diem`
- `1099 / Supplier Tax Reporting`

### Notes

These should build on the PTP foundation rather than bypassing it.

## Phase 13: Revenue, Contract, and Commercial Extensions

### Modules

- `Contract Management`
- `Order Management Controls`
- `Renewals Workflow`
- `Pricing Engine / Discounting Rules`
- `Revenue Contract Modifications`
- `Standalone Selling Price / SSP Support`

### Notes

These should integrate tightly with subscriptions, usage-based billing, FMV allocation, and revenue recognition.

### Notes

The reporting layer should support:

- as-of and period-based reporting
- dimensional slicing
- saved report views
- export
- drill-through to journal, transaction, line, and source record
- role-aware access
- package generation
- dashboard configuration
- board / management-ready presentation output

## Permissions and Governance

The current permissions page is not yet enterprise-grade.

When permissions are revisited, the target model should include:

- action-based permissions, not only CRUD
- scope-based access
  - own
  - team
  - subsidiary
  - all
- workflow/status restrictions as structured rules
- export / email / post / void / approve rights
- audit logging for permission changes

This should be addressed after the foundation phases above are underway, not before.

## Immediate Build Order

The next implementation order should be:

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4 onward

Within later phases, recommended order becomes:

1. Treasury including `Bank Matching`
2. Foundation master/setup records
3. Platform and integration services
4. Lead to Cash including `Billing Runs`
5. Procure to Pay including `Payment Runs`
6. Record to Report including `Revenue Recognition Journal Runs`, `Amortization Runs`, `Fixed Assets`, `Inventory`, consolidation, and tax
7. Close operations / interactive accounting checklist
8. Workflow / automation / governance platform
9. Deep reporting layer
10. Security / identity / compliance
11. Supply chain / procurement extensions
12. Revenue / contract / commercial extensions

This keeps the app from expanding faster than the foundation.

## Non-Negotiables

- Use shared components wherever possible
- Use dedicated line/allocation/schedule tables where needed
- Support backend and frontend together
- Design for auditability
- Design for historical reporting, not only current state
- Avoid page-specific data contracts when a shared platform contract is more appropriate
