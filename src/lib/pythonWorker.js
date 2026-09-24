/* global loadPyodide */
// Runs student Python in a background thread with Pyodide, so a run can be stopped by ending the worker.

const INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/'
let ready

function boot() {
  if (!ready) {
    ready = (async () => {
      importScripts(`${INDEX_URL}pyodide.js`)
      return loadPyodide({ indexURL: INDEX_URL })
    })()
  }
  return ready
}

self.onmessage = async ({ data }) => {
  const { id, code } = data
  let pyodide
  try {
    pyodide = await boot()
  } catch {
    ready = undefined
    self.postMessage({ id, ok: false, output: 'Could not load Python. Check your internet connection and try again.' })
    return
  }

  const output = []
  pyodide.setStdout({ batched: (line) => output.push(line) })
  pyodide.setStderr({ batched: (line) => output.push(line) })

  // Every run gets a fresh namespace so cells never depend on earlier runs.
  const scope = pyodide.globals.get('dict')()
  try {
    await pyodide.loadPackagesFromImports(code)
    await pyodide.runPythonAsync(code, { globals: scope })
    self.postMessage({ id, ok: true, output: output.join('\n') })
  } catch (error) {
    const message = String(error?.message ?? error)
    // Keep only the useful end of Python tracebacks.
    const trimmed = message.includes('File "<exec>"') ? message.slice(message.indexOf('File "<exec>"')) : message
    self.postMessage({ id, ok: false, output: [...output, trimmed.trim()].join('\n') })
  } finally {
    scope.destroy()
  }
}
