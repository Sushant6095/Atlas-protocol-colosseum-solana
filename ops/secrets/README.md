# ops/secrets

Webhook URLs and other operator secrets live here. Everything except this
file and `.gitignore` is gitignored.

## Layout

| File | Consumer | Format |
|---|---|---|
| `pagerduty.url` | `atlas-alert` `Page` sink | one URL, no quotes, no trailing newline |
| `slack.url` | `atlas-alert` `Notify` sink | one URL, no quotes, no trailing newline |
| `discord.url` | `atlas-alert` `Notify` sink (alt) | one URL |
| `digest.url` | `atlas-alert` `Digest` sink | one URL |
| `maintenance.json` | `atlas-alertctl maintenance` | array of `{start_unix, end_unix}` |

## Rotation

URLs that ship to PagerDuty/Slack are routing keys, not bearer tokens.
Rotate by issuing a new integration in the upstream tool, copying the new
URL into the file above, and `kill -HUP` of the orchestrator. There is no
in-process re-read of these files at runtime.

## Anti-patterns

- Never log webhook URLs.
- Never check secrets into git. The `.gitignore` in this directory enforces
  this; the CI pipeline rejects any tracked secret-shaped string.
- Never hard-code a secret in source. The orchestrator must read from this
  directory at startup.
