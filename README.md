# Donuts Department

The donutsforcops hub site: https://donutsdepartment.netlify.app

- `index.html` – the site. Shows, streamers, games and FAQ live in the `CONFIG` block ("EDIT ME").
- `games/` – the five arcade games, each self-contained.
- `netlify/functions/shows.mjs` – serves `/api/shows`, the live show schedule from the Whatnot Seller API.
  Needs the Netlify environment variable `WHATNOT_TOKEN` (a Whatnot personal access token with only **Read shows**).
  If the feed is unavailable, the site falls back to the schedule written in `index.html`.

Pushing to `main` redeploys the site on Netlify.
