const fs = require('fs')
const path = require('path')

const target = path.join(process.cwd(), '.next')
if (fs.existsSync(target)) {
  fs.rmSync(target, { recursive: true, force: true })
  console.log('Removed .next cache')
} else {
  console.log('.next cache not found')
}
