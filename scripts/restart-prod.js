const fs = require('fs')
const path = require('path')
const { spawn, spawnSync } = require('child_process')

const cwd = process.cwd()
const port = Number(process.env.PORT || '3003')
const host = process.env.HOST || '127.0.0.1'
const routePath = process.env.RESTART_PROD_ROUTE || '/bills'
const buildRequested = process.argv.includes('--build')

const logPath = path.join(cwd, 'start-server.log')
const errorLogPath = path.join(cwd, 'start-server-error.log')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function run(command, args, options = {}) {
  const isCmdScript = /\.(cmd|bat)$/i.test(command)
  const executable = isCmdScript ? 'cmd.exe' : command
  const finalArgs = isCmdScript ? ['/c', command, ...args] : args

  const result = spawnSync(executable, finalArgs, {
    cwd,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
    shell: false,
    windowsHide: true,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim()
    const stdout = result.stdout?.trim()
    throw new Error(
      `Command failed: ${command} ${args.join(' ')}\n${stderr || stdout || `exit ${result.status}`}`,
    )
  }

  return result.stdout ?? ''
}

function getListeningPids(targetPort) {
  const output = run('netstat.exe', ['-ano', '-p', 'tcp'])
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const pids = new Set()

  for (const line of lines) {
    if (!line.startsWith('TCP')) continue
    const parts = line.split(/\s+/)
    if (parts.length < 5) continue
    const localAddress = parts[1]
    const state = parts[3]
    const pid = Number(parts[4])

    if (state !== 'LISTENING' || !Number.isFinite(pid)) continue
    if (localAddress.endsWith(`:${targetPort}`)) {
      pids.add(pid)
    }
  }

  return [...pids]
}

async function waitForPortState(targetPort, shouldExist, timeoutMs) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const active = getListeningPids(targetPort)
    if (shouldExist ? active.length > 0 : active.length === 0) {
      return active
    }
    await sleep(250)
  }

  throw new Error(
    shouldExist
      ? `Timed out waiting for port ${targetPort} to start listening`
      : `Timed out waiting for port ${targetPort} to stop listening`,
  )
}

async function stopExistingServer() {
  const pids = getListeningPids(port)
  if (pids.length === 0) {
    return []
  }

  for (const pid of pids) {
    run('taskkill.exe', ['/PID', String(pid), '/F'], { stdio: 'pipe' })
  }

  await waitForPortState(port, false, 15000)
  return pids
}

function truncateLogFile(filePath) {
  fs.writeFileSync(filePath, '', 'utf8')
}

function startServer() {
  truncateLogFile(logPath)
  truncateLogFile(errorLogPath)

  const escapedCwd = cwd.replace(/'/g, "''")
  const escapedLogPath = logPath.replace(/'/g, "''")
  const escapedErrorLogPath = errorLogPath.replace(/'/g, "''")
  const launchCommand = [
    `Start-Process -FilePath powershell.exe`,
    `-ArgumentList '-NoLogo','-NoProfile','-Command','Set-Location ''${escapedCwd}''; npm.cmd start'`,
    `-WindowStyle Hidden`,
    `-RedirectStandardOutput '${escapedLogPath}'`,
    `-RedirectStandardError '${escapedErrorLogPath}'`,
  ].join(' ')

  const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', launchCommand], {
    cwd,
    detached: false,
    stdio: 'ignore',
    windowsHide: true,
    shell: false,
  })

  return child.pid
}

function readLogTail(filePath, length = 1200) {
  if (!fs.existsSync(filePath)) return ''
  const content = fs.readFileSync(filePath, 'utf8')
  return content.slice(Math.max(0, content.length - length))
}

async function fetchText(url) {
  const response = await fetch(url, { redirect: 'manual' })
  const text = await response.text()
  return { response, text }
}

async function verifyServer() {
  const routeUrl = `http://${host}:${port}${routePath}`
  const { response, text } = await fetchText(routeUrl)

  if (response.status !== 200) {
    throw new Error(`Route health check failed for ${routePath}: ${response.status}`)
  }

  const cssMatch = text.match(/\/_next\/static\/chunks\/[^"]+\.css/)
  if (!cssMatch) {
    throw new Error(`Could not find CSS asset reference in ${routePath}`)
  }

  const cssPath = cssMatch[0]
  const cssUrl = `http://${host}:${port}${cssPath}`
  const cssResponse = await fetch(cssUrl, { redirect: 'manual' })

  if (cssResponse.status !== 200) {
    throw new Error(`CSS asset health check failed for ${cssPath}: ${cssResponse.status}`)
  }

  return { routeUrl, cssPath }
}

async function waitForHealthyServer(timeoutMs = 30000) {
  const startedAt = Date.now()
  let lastError = null

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const activePids = await waitForPortState(port, true, 2000)
      const verification = await verifyServer()
      return { activePids, verification }
    } catch (error) {
      lastError = error
      await sleep(500)
    }
  }

  const stderrTail = readLogTail(errorLogPath)
  const stdoutTail = readLogTail(logPath)
  throw new Error(
    [
      lastError ? String(lastError.message || lastError) : 'Server did not become healthy',
      stderrTail ? `stderr tail:\n${stderrTail}` : '',
      stdoutTail ? `stdout tail:\n${stdoutTail}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
  )
}

async function main() {
  console.log(`Restarting production server on port ${port}...`)

  if (buildRequested) {
    console.log('Running production build...')
    run('npm.cmd', ['run', 'build'], { stdio: 'inherit' })
  }

  const stoppedPids = await stopExistingServer()
  if (stoppedPids.length > 0) {
    console.log(`Stopped existing listener(s): ${stoppedPids.join(', ')}`)
  } else {
    console.log('No existing app listener found on the target port.')
  }

  const spawnedPid = startServer()
  console.log(`Started npm start launcher with PID ${spawnedPid}. Waiting for health checks...`)

  const { activePids, verification } = await waitForHealthyServer()

  console.log(`Server is healthy on PID ${activePids.join(', ')}.`)
  console.log(`Verified route: ${verification.routeUrl}`)
  console.log(`Verified CSS asset: ${verification.cssPath}`)
  console.log(`Logs: ${path.basename(logPath)}, ${path.basename(errorLogPath)}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
