# Deploying PAC-LAB on Vercel

One Vercel project serves both halves:

- **Frontend**: the Vite build (`dist/`), with every page route falling back to `index.html`.
- **Backend**: the Express API (`server/app.js`) runs as one serverless function, `api/index.js`. All `/api/*` requests go to it (see `vercel.json`).
- **Database**: Vercel does not host MySQL, so use a hosted MySQL 8 database. The steps below use the free plan on [Aiven](https://aiven.io). Any MySQL 8 host that accepts outside connections works.

## 1. Create the database

1. Sign up at aiven.io, then choose **Create service → MySQL → Free plan**.
2. When the service is running, open its **Overview** and note the **Host**, **Port**, **User** (`avnadmin`) and **Password**.
3. Download the **CA certificate** (`ca.pem`) from the same page.

## 2. Load the tables and sample data (once, from your computer)

Put the hosted database's details in your local `.env`:

```env
DB_HOST=<aiven host>
DB_PORT=<aiven port>
DB_USER=avnadmin
DB_PASSWORD=<aiven password>
DB_NAME=pac_lab
DB_SSL=true
DB_SSL_CA="-----BEGIN CERTIFICATE-----
...paste the whole ca.pem here...
-----END CERTIFICATE-----"
```

Then run:

```bash
npm run db:setup
```

This creates the `pac_lab` database, its tables, the sample data and the demo accounts. **It resets all data**, so run it only for the first deployment.

Afterwards, switch `.env` back to your local MySQL if you still want to develop locally.

### If `db:setup` fails with `HANDSHAKE_SSL_ERROR` / `ECONNRESET`

Some networks (college or office firewalls, antivirus "SSL scanning") block encrypted MySQL connections from your computer. In that case, run the setup from Vercel instead, after step 3:

1. Add a `SETUP_TOKEN` environment variable (any random string of 24+ characters) and redeploy.
2. Run `curl -X POST https://<your-project>.vercel.app/api/setup -H "x-setup-token: <that string>"`.
3. Delete `SETUP_TOKEN` and redeploy. This turns the endpoint off again (it answers 404).

## 3. Create the Vercel project

1. Go to vercel.com and choose **Add New… → Project**.
2. Import the GitHub repository. Vercel reads `vercel.json`, so leave the framework, build and output settings as they are.
3. Under **Environment Variables**, add:

   | Name | Value |
   | --- | --- |
   | `DB_HOST` | Aiven host |
   | `DB_PORT` | Aiven port |
   | `DB_USER` | `avnadmin` |
   | `DB_PASSWORD` | Aiven password |
   | `DB_NAME` | `pac_lab` |
   | `DB_SSL` | `true` |
   | `DB_SSL_CA` | the full contents of `ca.pem`, pasted as is (several lines are fine) |
   | `SESSION_SECRET` | a long random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

4. Click **Deploy**.

## 4. Check the deployment

- `https://<your-project>.vercel.app/api/health` should return `{"ok":true}`.
  - A `503` means the database settings are wrong.
  - A `500` usually means `SESSION_SECRET` is missing.
- Sign in with a demo account:
  - Student `ML-2026-901` / `student@123`
  - Faculty `FAC-ML-014` / `faculty@123`

Every push to `main` now redeploys production automatically. Pushes to other branches get preview URLs.

## Deploying from the command line instead

```bash
npm i -g vercel
vercel login
vercel link            # create or connect the project
vercel env add DB_HOST production   # repeat for each variable in the table above
vercel --prod
```

## Notes

- **Sign-ins:** signed tokens, valid for 8 hours. Changing `SESSION_SECRET` signs everyone out.
- **Python:** the in-browser Python (Pyodide) loads from the jsDelivr CDN, so there is nothing to host for it.
- **Local development:** unchanged. Use `npm run dev:all`, or `npm run server` and `npm run dev`.
