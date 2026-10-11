# Guildbase — Discord Bot Dashboard

German-language dashboard starter for managing an existing Discord bot deployment on [Bot-Hosting.net](https://bot-hosting.net/). The static UI runs on Vercel and the `api/hosting.js` serverless function proxies a small allow-listed part of the provider API.

## Start locally

1. Install the Vercel CLI: `npm install --global vercel`
2. In this folder run `vercel dev` (or `npm run dev`).
3. Open the local URL, go to **Bot & Hosting**, and enter a Bot-Hosting.net developer API key.

No Vercel environment variables are required for this starter. Each dashboard user supplies their own scoped Bot-Hosting.net API key at runtime. The key is held in browser memory only; reloading the page clears it. Do not put an individual user's Discord bot token into Vercel project-wide environment variables. The token field writes `DISCORD_TOKEN` as a secret environment variable on the selected hosting deployment.

## API key scopes

Create a key in Bot-Hosting.net **Account → Developer**. For this interface, grant only what you use:

- `deployments:read` — list deployments and read logs
- `deployments:power` — start, stop, restart (`POST /deployments/:id/power` with the selected action)
- `env:write` — set the secret `DISCORD_TOKEN` environment variable

The provider API is in public beta and can change. Check [its API documentation](https://bot-hosting.net/api) before production use.

## Deploy to Vercel

Import this folder/repository in Vercel, leave the framework preset as **Other**, and deploy with the root directory set to this folder. The included `vercel.json` routes the static assets and serverless API function. Alternatively, after installing the Vercel CLI, use `vercel` and then `vercel --prod`.

## Current scope

The hosting connection, deployment listing, logs, environment-variable write, and power controls call the provider API. The Tickets, Level & XP, Team-System, and AutoMod screens are a front-end configuration prototype; persistent per-server settings, Discord OAuth, bot-side runtime code, permissions, a database, and multi-user accounts still need implementation before this can be offered as a complete public dashboard. Never advertise those module settings as live until their storage and bot integration are connected.
