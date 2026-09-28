// PAC-LAB API for local development: npm run server   (Vite proxies /api to it)
// On Vercel the same app runs as a serverless function instead (api/index.js).

import 'dotenv/config'
import { ensureAccounts } from './accounts.js'
import app from './app.js'
import { pool } from './db.js'

const PORT = Number(process.env.API_PORT || 8787)

ensureAccounts(pool)
  .then(() => app.listen(PORT, () => console.log(`PAC-LAB API listening on http://localhost:${PORT}`)))
  .catch((error) => {
    console.error('Could not prepare the database:', error.message)
    console.error('Run "npm run db:setup" first and check the settings in .env.')
    process.exit(1)
  })
