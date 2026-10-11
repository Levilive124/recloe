# recloe

recloe is a German-language community chat prototype with email/password accounts and a MySQL-backed API.

## MySQL setup

The project includes `schema.sql` for MySQL 8. Run it once on a persistent MySQL database. The API creates user records, bcrypt password hashes, 30-day revocable sessions, spaces, memberships, channels and channel messages there.

Set these environment variables in **Vercel → Project → Settings → Environment Variables**:

- `DATABASE_URL` — `mysql://USER:PASSWORD@HOST:3306/DATABASE` from your MySQL host
- `DATABASE_SSL` — leave unset or set to `true` for a TLS connection; set to `false` only for local MySQL without TLS

Set the same values in a local `.env` file for local development. `.env` is ignored by Git. Never commit the real connection string. The checked-in `.env.example` is only a template.

Deploy the folder to Vercel after the schema and variables are ready. For local use, install dependencies with `npm install` and run `npx vercel dev`.

## Accounts and sessions

Registration requires an email, a password with at least 10 characters, and password confirmation. The plaintext password is never stored. The API hashes it with bcrypt and issues a random, HTTP-only, SameSite cookie. A hash of that session token is stored in MySQL, so the session survives a Vercel function restart; it expires after 30 days or when the user logs out. Users must still be able to access their persistent MySQL database for login.

## Current persistence scope

Accounts, spaces, text channels, channel messages, direct-message conversations and direct messages use MySQL. Friends, calls, attachments and the member roster remain prototype-only. Email ownership verification, password reset and abuse/rate-limit controls are still needed before public production use.

The MySQL connection itself is not provisioned in this repository. You must create a database with a hosting provider, run `schema.sql`, and add its connection URL in Vercel. Do not paste database credentials into chat or commit them.
