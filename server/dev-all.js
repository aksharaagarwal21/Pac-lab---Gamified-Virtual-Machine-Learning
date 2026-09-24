// Starts the API server and the Vite dev server together: npm run dev:all
import { spawn } from 'node:child_process'

const run = (script) => spawn('npm', ['run', script], { stdio: 'inherit', shell: true })
const children = [run('server'), run('dev')]

const stop = () => {
  children.forEach((child) => child.kill())
  process.exit()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
children.forEach((child) => child.on('exit', (code) => code && stop()))
