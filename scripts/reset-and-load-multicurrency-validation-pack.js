const { spawnSync } = require('node:child_process')
const path = require('node:path')

function runScript(name) {
  const scriptPath = path.join(__dirname, name)
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

runScript('reset-transaction-history.js')
runScript('load-multicurrency-validation-pack.js')
