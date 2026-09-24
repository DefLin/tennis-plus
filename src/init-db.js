const fs = require('node:fs/promises')
const path = require('node:path')
const { pool } = require('./db')

async function main() {
  const files = ['001_init.sql', '002_seed_slots.sql']
  for (const file of files) {
    const sql = await fs.readFile(path.join(__dirname, '..', 'sql', file), 'utf8')
    for (const statement of sql.split(';').map(item => item.trim()).filter(Boolean)) await pool.query(statement)
    console.log(`Applied ${file}`)
  }
  await pool.end()
}
main().catch(error => { console.error(error); process.exit(1) })
