// Client for the Python worker. Python downloads on the first run (about 10 MB) and is then cached.

let worker = null
let nextId = 0
const pending = new Map()

function settleAll(result) {
  pending.forEach((resolve) => resolve(result))
  pending.clear()
}

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./pythonWorker.js', import.meta.url))
    worker.onmessage = ({ data }) => {
      pending.get(data.id)?.(data)
      pending.delete(data.id)
    }
    worker.onerror = () => {
      settleAll({ ok: false, output: 'Python stopped unexpectedly. Try running again.' })
      worker?.terminate()
      worker = null
    }
  }
  return worker
}

export function runPython(code) {
  return new Promise((resolve) => {
    const id = ++nextId
    pending.set(id, resolve)
    getWorker().postMessage({ id, code })
  })
}

export function stopPython() {
  if (!worker) return
  worker.terminate()
  worker = null
  settleAll({ ok: false, stopped: true, output: 'Run stopped. Python restarts on your next run.' })
}
