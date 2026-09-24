import 'dotenv/config'
import mysql from 'mysql2/promise'

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pac_lab',
}

export const pool = mysql.createPool({
  ...dbConfig,
  connectionLimit: 10,
  decimalNumbers: true,
})
