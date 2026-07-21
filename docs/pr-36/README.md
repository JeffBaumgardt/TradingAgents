# PR #36 review screenshots

Visual evidence for the pricing + hosted billing work.

| File | What it shows |
|------|----------------|
| `01-pricing.png` | Public `/pricing` — Layout A dual cards (BYOK $3 / Hosted $29), monthly/annual toggle |
| `02-billing-preview.png` | Earlier `/billing-preview` (pre compute-credit tree) |
| `03-checkout-hosted.png` | `/checkout?plan=hosted&interval=monthly` — scaffold checkout entry |
| `04-billing-usage-tree.png` | `/billing-preview` — account-level compute credit bar + expanded provider→model tree with multipliers |
| `05-billing-provider-collapsed-credits.png` | Same page with providers collapsed (aggregate tokens/credits only) |

Signed-in surfaces (not captured here; require Clerk):

- `/settings/billing` — live scaffold account for the user
- Wizard step 6 — provider select with Hosted / Your key / Upgrade required + upgrade nudge
- `/settings/credentials` — Your key badge on providers with a saved key
