# Owner to-do list

Everything that Claude Code and VS Code cannot do on their own: dashboard settings, account actions, decisions and reviews that need a person.
Claude keeps this file current. When a new item comes up it is added here, and when you finish one it moves to "Done".

Last updated: 2026-11-11

## Do now

| # | What | Where | Why it matters |
|---|---|---|---|
| 1 | Apply database migrations 0027 to 0030 | Terminal in this repo: `npm run db:migrate:remote` (or ask Claude to run it) | The new tables do not exist on the live database yet. The health check will report them missing until they do. |
| 2 | Change the build command to `npm run build:frontend && npx wrangler d1 migrations apply trade-compliance-db --remote` | Cloudflare dashboard > Workers & Pages > this Worker > Settings > Build. If the build fails on permissions, edit the build token on that page to allow editing D1. | Future migrations then apply on their own with each deploy. |
| 3 | Allow GitHub Actions to create pull requests | GitHub repo > Settings > Actions > General > "Allow GitHub Actions to create and approve pull requests" | The weekly Country Chart bot needs it. |
| 4 | Turn on email alerts | Cloudflare dashboard > aexmeridian.com > Email > Email Routing: enable it, add and verify CEO@aexmeridian.com. Then uncomment the `send_email` line in `wrangler.jsonc` and push (or ask Claude to). | Until then alerts are only written to the Worker log, so nobody is told when something breaks. |
| 5 | Add an uptime monitor | UptimeRobot (free): check `https://aexterminal.com/api/health` every 5 minutes | Catches the Worker itself being down, which it cannot report about itself. |
| 6 | Replace the exposed API keys | Anthropic console: revoke old keys. Then `wrangler secret put ANTHROPIC_API_KEY` | Keys pasted into chats should be treated as compromised. |

## Decisions

- Monthly calculator budget: default is $30 (`MONTHLY_BUDGET_USD` in the Worker variables). Tell Claude the number you want.
- Key and token expiry reminders: set `REMINDER_DATES` to e.g. `anthropic key:2027-01-15,cloudflare token:2027-03-01` to have them listed in the Monday summary.

- Soft Power data that needs a free key (UN Comtrade for bilateral trade; optionally IATI for aid by recipient): say if you want them, then create the free account and run `wrangler secret put <NAME>`. Claude will name the secret. Also ask RSF (rsf.org) in writing what reuse they allow for the Press Freedom Index; if they confirm open reuse, it can be added.

## Recurring (when an email or reminder arrives)

- **Pending law notices.** When an email says notices are pending, read each one (the link is in the email). If it changes a rate, scope or date the calculator uses, tell Claude; it edits the curated rows. If not, dismiss it (command in `docs/OPERATIONS.md`). Nine are pending in the local copy, including new Section 232 actions on robotics and wind turbines.
- **Country Chart pull request** (weekly bot, only when the official chart changed): read the listed changes, merge if right.
- **Dated chores** (listed in the Monday summary): October change to the customs fee limits, January HTS revision, July USMCA anniversary, end of the fee schedule on 2027-09-30.
- **Top up Anthropic credit** when the calculator reports it is paused. Only the calculator spends credit. The accuracy scripts need `--confirm-cost` and ask first.

## Needs a person's judgment

- A licensed customs broker should review the curated duty rates and the customs fee limits (the fee limits come from secondary sources, not an official page).
- Optional: turn on Dependabot auto-merge for patch updates (GitHub repo settings).

## Open engineering work (Claude can do these when you say so, none call the model)

- Load the full Commerce Control List into the ECCN table (8 entries today).
- Fee-schedule pull request bot.
- Sanctions list lag warning.

## Done

- 2026-11-11: self-monitoring system committed and pushed (0e49cd3). Hard Power overview page lengthened with trade, sanctions, money and military sections.
