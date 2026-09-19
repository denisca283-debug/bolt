# AI allowance and credits

## IMPLEMENTED

Canonical personal/organization wallets, append-only credit ledger, immutable usage records and server-owned operation catalogue. User cannot set credit cost or grant/refund credits.
Live wallet/project scope and organization use_ai permission are checked on every debit, including replay. Company wallet requires same-company project. Removing membership immediately denies spending.
Wallet row lock serializes balances. Debits are transactional and idempotent; reference reuse with changed actor/project/operation is rejected. Refund appends the exact inverse of one debit once.
Records preserve initiating user, wallet, project, operation/catalog version, credits and server infrastructure estimate.
Configurable welcome/monthly free allowances are idempotent by wallet and UTC period. Trusted grant adapter supports future subscription/topup/bonus use with server-prefixed idempotency references.

## FOUNDATION ONLY

Catalogue entries and free policy are DISABLED by default. The local tests enable fixtures only.
No real provider operation executes, no customer charge, no advertised unlimited AI. Credits are internal non-transferable usage units, not money, crypto or tradable tokens. PRO and referral/promotion/tender units remain separate product entitlements; none buys verification or organic ranking. See [digital-assets-blockchain-readiness.md](digital-assets-blockchain-readiness.md) for future settlement separation. No credit-to-token conversion exists.
Referral approved rewards are not automatically fulfilled into these wallets.

## FUTURE DEPENDENCY

Provider-backed lightweight free value, reviewed free limits, subscription entitlement worker, payment adapter, transactional usage reservation/settlement around provider execution, failed-work compensation worker and company spend controls.

## RELEASE BLOCKER

Do not enable public debit endpoint/catalogue before trusted execution and billing review. No self-service topup/cash payout. Paid allowance changes usage only, not organic ranking or professional/minor permissions. External provider failure/retry integration still needs staging evidence.
