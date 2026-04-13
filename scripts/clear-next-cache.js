const fs = require('fs')
const path = require('path')

const target = path.join(process.cwd(), '.next')
if (fs.existsSync(target)) {
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
  console.log('Removed .next cache')
} else {
  console.log('.next cache not found')
}
