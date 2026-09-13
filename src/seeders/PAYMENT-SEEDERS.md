# Payment administration seeders

The existing `npm run seed` now seeds payment administration after its workspaces and users. Use the dedicated command below to avoid running unrelated seeders.

From `backend`, preview a selected database without writes:

```powershell
npm.cmd run seed:payments -- --env-file .env.development --workspace brand-ecommerce --workspace vizr --workspace ibrahem-portfolio
```

Insert missing records into the selected database:

```powershell
npm.cmd run seed:payments -- --env-file .env.development --workspace brand-ecommerce --workspace vizr --workspace ibrahem-portfolio --apply
```

`--env-file` defaults to `.env`. Use the environment file for the intended database. At least one existing workspace must be explicitly selected; missing workspaces fail before any seed writes. The dedicated runner disables automatic collection/index creation and uses the existing database connector.

| API | Seeder | Records on an empty catalog |
| --- | --- | --- |
| `/api/admin/pricings` | `seedPricings` | Starter, Launch, Scale Pro and Enterprise; USD monthly/yearly template prices |
| `/api/admin/payment-methods` | `seedPaymentMethods` | Stripe and Vodafone Cash, disabled/test-mode, no credentials |
| `/api/admin/payments` | `seedPayments` | Six sample payment statuses per selected workspace |
| `/api/admin/subscriptions` | `seedSubscriptions` | Two historical records per selected workspace: canceled and expired |

All writes use insert-only upserts with timestamps disabled for existing documents. Reruns preserve owner-edited plans, configured credentials, transactions, subscriptions, and their timestamps. Subscription IDs and transaction references are stable. Every sample transaction has a distinct `providerRef`, including pending/manual samples, to satisfy the existing sparse unique index without repeated null values.

Sample payments have `SEED-PAYMENT-V1-...` references, sample payer names and reserved `example.test` email addresses. No payment provider is contacted and no money moves. Historical subscriptions use provider `seed`, have ended billing periods, and do not replace or add active subscriptions. These records populate administration screens; they do not implement checkout or settlement.

New pricing templates are published/public in the administration catalog. Review their prices/features before using them for commercial offers. Existing plans with the same codes are preserved; sample transactions use the existing Starter price/currency when present. Existing enabled payment methods remain enabled without modification.

Isolated verification:

The Subscription schema's duplicate workspace-index declaration was corrected, and the partial unique index is explicitly named `workspace_live_subscription`. A fresh database can now initialize it and enforce one live subscription per workspace while allowing historical records. The dedicated seed runner does not drop or rebuild existing production indexes.

```powershell
npx.cmd tsx --test src/seeders/paymentAdministration.integration.test.ts
npm.cmd run build
```
