# CoinPay for contribution payments

DefPromo supports manual `/coinpay` commands in new pull-request comments. The
workflow checks the commenter's **current write, maintain, or admin permission**
with GitHub before invoking the pinned CoinPay action. Organization membership or
a prior contribution alone does not authorize a command. Edited comments, bots,
ordinary issue comments, and unrelated text are ignored.

No PR amount or automatic billing event is configured. Opening or merging a PR
does not create an invoice or send funds.

## Setup

1. A maintainer configures a CoinPayPortal business and confirms which account
   owns its API key and payment records.
2. Provide `COINPAY_API_KEY` and `COINPAY_BUSINESS_ID` through repository Actions
   secrets, or organization secrets explicitly available to this repository.
   Never put a key in a comment, workflow file, or PR.
3. Review [the repository configuration](../.github/coinpay.yml). USD and Polygon
   USDC are defaults; `--crypto` can select a different supported settlement
   currency. Verify the recipient address belongs to the contributor and matches
   that currency before creating a payment.
4. Check the **CoinPay PR commands** run after a maintainer's command. If either
   secret is unavailable, its summary explains setup and the action is skipped.

At installation review, no repository-level CoinPay secrets were present.
Inherited organization secrets were not established by the audit. Adding this
workflow alone does not mean live invoicing has been verified.

## Preview, then create an explicit contribution payment

A maintainer posts the command on the contribution's PR, replacing the example
amount and address with the agreed terms:

```text
/coinpay create 25 USD --crypto usdc_pol --wallet <verified-contributor-address> --dry-run
```

`25` is an example amount, not a per-PR rate. The bot replies with a preview of the
amount, settlement currency, receiving wallet, PR/linked-issue description and
payment identity. **Preview posts a GitHub reply but makes no CoinPay API call.**

After checking the terms, the maintainer posts a new comment without `--dry-run`:

```text
/coinpay create 25 USD --crypto usdc_pol --wallet <verified-contributor-address>
```

This creates a CoinPay **payment request/link** directed to the explicit
contributor wallet. The owner pays through that link. Creation does not transfer
funds, and a created link is not evidence that the contributor has been paid.
Review the platform fee and final recipient amount in CoinPay.

The current action's PR payment command deduplicates identical PR/amount/coin/
wallet terms. It is not a one-invoice-per-PR entitlement: changed terms or a
repository rename can form a different identity. For an uncertain response,
inspect the existing payment/run before posting another command. GitHub replies
are only best-effort deduplicated. `/coinpay status` explains that payment status
must be checked at CoinPay; there is no live payment-status webhook in this action.

## Payment requests and formal invoices are different

The legacy `/coinpay invoice` command also creates a payment request. Without an
explicit wallet it defaults to the configured business's receiving wallet, so it
must not be mistaken for a payment to the contributor. For contribution payments,
use the explicit-wallet PR command above.

The upstream `/coinpay create @payer ...` flow creates and publishes a formal
invoice issued by the repository's business. `@payer` is only a GitHub mention;
it does not link a contributor's CoinPay account. That flow remains disabled with
`githubInvoices.enabled: false`. A contributor invoice/payee mapping and any
automatic per-PR policy require a separate change.

## Local checks

The shared [permission and setup tests](https://github.com/profullstack/coinpaybot/blob/b315d622736672f8f5a76ac56e12f0956549cd03/scripts/check-pr-workflow.mjs)
live in CoinPayBot and run in its CI. They execute the actual workflow scripts
with mocked GitHub responses and fake credentials, making no network requests or
financial resources. DefPromo keeps only the small caller and repository
configuration; the checks are maintained upstream with the shared job.

Pinned [shared workflow b315d62](https://github.com/profullstack/coinpaybot/blob/b315d622736672f8f5a76ac56e12f0956549cd03/.github/workflows/pr-commands.yml),
running [coinpaybot fbf0991](https://github.com/profullstack/coinpaybot/tree/fbf099175de2d8f6ed105b20d677e7a30b19cfac).
