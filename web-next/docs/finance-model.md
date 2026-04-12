# Admin / Client Finance Model

## Core Rules

- `Wallet Balance` is the client wallet only. Source: `/wallet.available_balance` or fallback `/wallet.balance`.
- `Completed Funding` is money delivered to ad accounts. It is not the same as wallet debit.
- `Client Funding` is the requested funding principal before fee and VAT.
- `Total Wallet Debit` = `Client Funding + Acquiring Fee + VAT`.
- `Net Account Funding` is the amount received by the ad account after conversion logic.
- `Spend` is platform spend from insights or live billing. It must never be mixed with wallet values.

## Canonical Topup Breakdown

For every topup row:

- `Client Funding`: `amount_input`
- `Acquiring Fee`: `amount_input * fee_percent / 100`
- `VAT`: `amount_input * vat_percent / 100`
- `Total Wallet Debit`: `amount_input + fee + vat`
- `Net Account Funding`: `amount_account`, fallback `amount_net`, fallback `amount_input`
- `FX Rate`: `fx_rate`
- `Completed Funding USD`: `amount_account_usd`, fallback derived from `amount_net` / `amount_input`
- `Completed Funding KZT`: `amount_account_kzt`, fallback derived from `amount_net * fx_rate`, fallback `amount_input`

## Canonical Account Balance Logic

Per account:

- Primary balance source: live account balance from `live_billing`
- Fallback balance source: `completed funding - period spend`
- `balanceSource` values:
  - `live`
  - `fact_minus_spend`
  - `none`

## UX Contract

- Client and admin must use the same labels for:
  - `Available Balance`
  - `Monthly Spend` / `Platform Spend`
  - `Completed Funding`
  - `Client Funding`
  - `Acquiring Fee`
  - `VAT`
  - `Total Wallet Debit`
  - `Net Account Funding`
- Gross and net values must never be collapsed into one number without a label.
- Any fallback-derived number must expose its source state such as `Live`, `Estimated`, or `Unavailable`.
