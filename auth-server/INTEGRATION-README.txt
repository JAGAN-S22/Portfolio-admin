PORTFOLIO + ADMIN LOGIN + MFA + PROJECT MANAGEMENT

What the login is for:
- Public homepage remains open to everyone at /
- Admin Login is linked from the public navigation at /login.html
- Password + authenticator MFA protects /admin and admin APIs
- The private dashboard lets you add, edit and delete extra portfolio projects
- Projects are stored in data/auth.db and appear in the public homepage under “More Projects”
- The original three featured projects remain unchanged

Install/update:
1. Stop the server (Ctrl+C).
2. Back up your existing auth-server directory.
3. Extract this ZIP into the existing auth-server directory and allow replacement of server.js and public files.
4. Keep your existing .env, data directory, node_modules, package.json and package-lock.json.
5. Start with: npm.cmd run dev
6. Visit http://localhost:3000/ and click Admin Login.
7. Log in with your configured admin email/password and MFA.
8. In the dashboard, use the project form to publish an additional project; refresh the public homepage to see it.

Do not delete data/auth.db or change MFA_ENCRYPTION_KEY after enrollment; the database contains your encrypted MFA secret.
Keep .env and data private. For production, add CSRF tokens, TOTP replay prevention, recovery codes, secure recovery/password rotation, HTTPS, and trusted reverse-proxy/session configuration. Rotate any secrets previously shared in chat before deployment.
