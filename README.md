# Mokshith.AI Portfolio

## Run locally

Set the admin credentials in the same PowerShell window before starting the server:

```powershell
$env:ADMIN_USERNAME = "admin"
$env:ADMIN_PASSWORD = "use-a-unique-password-of-at-least-12-characters"
npm run dev
```

Open `http://localhost:3000`, then use the lock icon in the top navigation to sign in. Configure `ADMIN_USERNAME` and `ADMIN_PASSWORD` as private environment variables in your hosting provider before deployment; never put them in client-side code or commit them to the repository. Use a unique password of at least 12 characters.

Portfolio content remains publicly readable. Creating, editing, deleting, and uploading content requires an admin session, and those server endpoints reject unauthenticated and cross-origin requests. Admin sessions use an HTTP-only, same-site cookie and expire after eight hours; restarting the server signs out existing sessions.

Deploy behind HTTPS and keep the Node server running as a single instance: sessions are held in memory, while portfolio content and uploaded files are stored in the project data and asset directories.
