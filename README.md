# CRM ERP PNF

Custom CRM/ERP platform to support:
- CRM and Quote-to-Cash (Q2C)
- Procure-to-Pay (P2P)
- Record-to-Report (R2R)
- AP Portal with OCR, learned coding, approval workflow, and PO matching
- Revenue Recognition (ASC 606)
- Lease Accounting (ASC 842)
- Fixed Assets, Inventory, Projects, Work Orders
- Subscription, usage, and scheduled billing
- Forecasting, cash forecasting, KPI dashboards, and reporting

## Initial Build Plan
1. Establish architecture and module boundaries
2. Create backend API and database foundation
3. Create frontend shell and navigation
4. Add auth, roles, permissions, custom fields, and custom transaction types
5. Add core CRM / Q2C / P2P / R2R modules incrementally

## Proposed Initial Stack
- Frontend: Next.js + TypeScript
- Backend: NestJS + TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Auth: NextAuth / enterprise SSO later
- Infrastructure: Docker

## Next Artifacts
- system architecture
- domain model
- module map
- MVP scope
- repository scaffold
