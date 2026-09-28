// Creates the PAC-LAB database, its tables, a large sample dataset and the demo accounts.
// Shared by "npm run db:setup" (server/setup.js) and the one-time Vercel endpoint (api/setup.js).
// Warning: this resets all data, including progress saved by students who signed in.

import { readFile } from 'node:fs/promises'
import mysql from 'mysql2/promise'
import { ensureAccounts } from './accounts.js'
import { dbConfig } from './db.js'
import { buildDataset } from './seed.js'

const CHUNK = 2000

export async function setupDatabase(log = console.log) {
  const { database, ...server } = dbConfig
  if (!/^\w+$/.test(database)) throw new Error(`Invalid DB_NAME "${database}": use letters, digits and underscores only.`)

  const started = Date.now()
  const connection = await mysql.createConnection({ ...server, multipleStatements: true })
  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`)
    await connection.query(`USE \`${database}\``)
    await connection.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'))
    log(`Created tables in "${database}".`)

    const tables = buildDataset()
    await connection.beginTransaction()
    for (const { table, columns, rows } of tables) {
      for (let i = 0; i < rows.length; i += CHUNK) {
        await connection.query(`INSERT INTO \`${table}\` (${columns.map((c) => `\`${c}\``).join(', ')}) VALUES ?`, [rows.slice(i, i + CHUNK)])
      }
      log(`  ${table.padEnd(20)} ${rows.length.toLocaleString('en-IN').padStart(8)} rows`)
    }
    await connection.commit()
    await ensureAccounts(connection)

    const total = tables.reduce((sum, t) => sum + t.rows.length, 0)
    log(`Inserted ${total.toLocaleString('en-IN')} rows in ${((Date.now() - started) / 1000).toFixed(1)}s.`)
    return { total, seconds: (Date.now() - started) / 1000 }
  } catch (error) {
    await connection.rollback().catch(() => {})
    throw error
  } finally {
    await connection.end()
  }
}
