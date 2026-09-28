// Vercel serverless function: every /api/* request is routed here (see vercel.json).
// Demo accounts and the progress table are created by "npm run db:setup", not on each cold start.
import app from '../server/app.js'

export default app
