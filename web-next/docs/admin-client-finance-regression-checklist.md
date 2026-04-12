# Admin / Client Finance Regression Checklist

Use the same client account and the same time window when checking both sides.

## Wallet

- `Client Overview > Available Balance` equals `Client Finance > Available Balance`.
- Admin wallet balance for the same client matches the client wallet source value.
- If wallet is KZT, the number itself matches; only contextual FX hints may differ in presentation.

## Topups / Funding

- `Client Funding` matches `amount_input`.
- `Acquiring Fee` matches `amount_input * fee_percent / 100`.
- `VAT` matches `amount_input * vat_percent / 100`.
- `Total Wallet Debit` matches `Client Funding + Acquiring Fee + VAT`.
- `Net Account Funding` matches `amount_account`, fallback `amount_net`, fallback `amount_input`.
- Admin topup row and client finance topup detail show the same gross/net breakdown.

## Completed Funding

- Client overview capital flow uses completed funding, not raw wallet debit.
- Admin client summary `Пополнено` uses completed funding KZT logic, not raw `amount_input`.
- If `amount_account_kzt` exists, it wins over local fallback math.

## Accounts

- If live billing balance exists, both client and admin treat it as primary.
- If live billing balance is missing, both use `completed funding - period spend` as fallback.
- `balanceSource` is exposed consistently as `Live`, `Estimated`, or `Unavailable`.

## Spend

- `Monthly Spend` in client overview matches the same overview spend window used for capital flow.
- `Platform Spend` in client finance is based on the same spend aggregation rule.
- Spend is never mixed with wallet balance or wallet debit values.

## Invoices / Docs

- Open invoice request count in client finance matches the actionable invoice state in admin.
- Finance docs are document records only; they do not change wallet/funding totals.
