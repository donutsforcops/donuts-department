# Donuts Department

The donutsforcops hub site: https://donutsdepartment.netlify.app

## What's where
- `index.html` – the site, built from `dfc-hub/template.html`. Streamers come from `crew.json`.
- `crew/<handle>/` – a page for each recommended streamer.
- `custody/` – shipping and authenticity page.
- `games/` – six arcade games. `games/score.js` offers to file a score on the weekly leaderboard.

## Live data (Netlify Functions)
| Path | What it does | Needs |
|---|---|---|
| `/api/shows` | upcoming and live shows | `WHATNOT_TOKEN` (Read shows) |
| `/api/past` | recent finished shows for the evidence room | `WHATNOT_TOKEN` |
| `/api/stats` | Department records totals | `WHATNOT_STATS_TOKEN` (Read shows, Read reports) |
| `/api/lineup` | items lined up for each upcoming show | `WHATNOT_SHOP_TOKEN` (Read inventory, Read merchandising, Read shows) |
| `/api/sold` | recently sold items, title and price only | `WHATNOT_SHOP_TOKEN` (Read orders). Never give it Read customers. |
| `/api/scores` | weekly arcade leaderboard | nothing (Netlify Blobs) |

Every section that depends on a token stays hidden until the token is set and the site is redeployed.
The APB form uses Netlify Forms: turn on form detection under Forms in the Netlify project.

## Deploys
Pushing to `main` deploys to production and uses Netlify credits (15 per deploy), so batch changes.
Other branches don't deploy.
