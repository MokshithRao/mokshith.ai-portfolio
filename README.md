# Mokshith.AI Portfolio

## Run locally

Start the server with:

```powershell
npm run dev
```

The local `.env` file supplies test admin credentials and is excluded from Git. Open `http://localhost:3000` and use the lock icon to sign in. To use different local credentials, edit `.env` or copy `.env.example` and replace its placeholder values. Do not commit `.env` or use its local test password in production. Configure `ADMIN_USERNAME` and `ADMIN_PASSWORD` as private environment variables in your hosting provider before deployment.

## Admin password recovery

Password recovery sends a single-use link to `mokshithrao310@gmail.com` using the Resend API. Create a Resend API key and verify the sender domain used in `ADMIN_RESET_FROM`. To test email recovery locally, add `RESEND_API_KEY` and `ADMIN_RESET_FROM` to `.env`; `PUBLIC_APP_URL` is already set for localhost. In production, set `PUBLIC_APP_URL` to the site's canonical HTTPS URL and configure `RESEND_API_KEY`, `ADMIN_RESET_FROM`, and `PUBLIC_APP_URL` as private environment variables. Reset requests are rate-limited; links expire after 15 minutes, and changing the password invalidates existing admin sessions.

The new password is stored as a salted scrypt hash in `private/admin-credentials.json`, which is excluded from static file serving and Git. Keep the `private` directory on persistent storage when deploying so password changes survive restarts and redeployments. If email recovery is unavailable, an operator can stop the server, remove that file, restore the intended `ADMIN_PASSWORD` environment variable, and restart the server.

Portfolio content remains publicly readable. Creating, editing, deleting, and uploading content requires an admin session, and those server endpoints reject unauthenticated and cross-origin requests. Admin sessions use an HTTP-only, same-site cookie and expire after eight hours; restarting the server signs out existing sessions.

Deploy behind HTTPS and keep the Node server running as a single instance: sessions are held in memory, while portfolio content and uploaded files are stored in the project data and asset directories.
