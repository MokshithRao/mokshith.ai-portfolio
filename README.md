# Mokshith.AI Portfolio

## Run locally with Node

Set the admin credentials in PowerShell before starting the local server:

```powershell
$env:ADMIN_USERNAME = "admin"
$env:ADMIN_PASSWORD = "use-a-unique-password-of-at-least-12-characters"
npm run dev
```

Open `http://localhost:3000`. The local Node server stores content in `data/` and uploads in `assets/`.

## Deploy to Cloudflare for free

The Cloudflare deployment uses a Worker for the API, D1 for portfolio content and admin sessions, R2 for newly uploaded images and certificates, and Workers Static Assets for the site. The existing JSON files are imported into D1 automatically the first time each collection is requested. Existing files in `assets/` are deployed as static assets.

1. Use Node.js 22 or later, install dependencies, and authenticate with Cloudflare:

   ```powershell
   npm install
   npx wrangler login
   ```

2. Create the database and upload bucket:

   ```powershell
   npx wrangler d1 create mokshith-portfolio-db
   npx wrangler r2 bucket create mokshith-portfolio-uploads
   ```

   Copy the D1 `database_id` returned by the first command into `wrangler.jsonc`. The R2 bucket name in that file must match the bucket you created.

3. Apply the database schema and set private admin credentials:

   ```powershell
   npm run cf:migrate:remote
   npx wrangler secret put ADMIN_USERNAME
   npx wrangler secret put ADMIN_PASSWORD
   ```

   Use a unique password of at least 12 characters. Wrangler prompts for secret values; do not put them in source code or commit them.

4. Publish the site and API:

   ```powershell
   npm run deploy
   ```

   Cloudflare prints the deployed `workers.dev` URL. You can attach a custom domain to the Worker from the Cloudflare dashboard.

### Local Cloudflare preview

Create an ignored local secrets file from the example and replace both values with local-only credentials:

```powershell
Copy-Item .dev.vars.example .dev.vars
notepad .dev.vars
npm run cf:migrate:local
npm run dev:cloudflare
```

Open the URL printed by Wrangler. The local Worker preview uses local D1 and R2 emulation; uploaded content is separate from the Node server's local files.

### Cloudflare free-plan notes

The Worker, D1 database, R2 bucket, and static assets use Cloudflare's free allowances, which are subject to Cloudflare's current quotas and request limits. Uploads are limited to 8 MB per file by the Worker. The current application has no password-reset endpoint; admin password changes are made by updating the `ADMIN_PASSWORD` Worker secret, which invalidates existing sessions.
