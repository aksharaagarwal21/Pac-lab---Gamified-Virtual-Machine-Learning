import 'dotenv/config'
import mysql from 'mysql2/promise'

// Hosted MySQL (Aiven, TiDB Cloud, Railway…) needs TLS: set DB_SSL=true, and DB_SSL_CA to the
// provider's CA certificate (PEM text; literal "\n" escapes are accepted) when it is not publicly trusted.
function sslConfig() {
  if (!/^(1|true|yes|required)$/i.test(process.env.DB_SSL ?? '')) return undefined
  const ca = process.env.DB_SSL_CA?.replace(/\\n/g, '\n')
  return { minVersion: 'TLSv1.2', rejectUnauthorized: true, ...(ca ? { ca } : {}) }
}

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pac_lab',
  ssl: sslConfig(),
}

// Serverless instances each hold their own pool, so keep them small there.
export const pool = mysql.createPool({
  ...dbConfig,
  connectionLimit: process.env.VERCEL ? 3 : 10,
  maxIdle: process.env.VERCEL ? 1 : 10,
  idleTimeout: 60000,
  enableKeepAlive: true,
  decimalNumbers: true,
})
