// Ad-hoc production UI verification for the in-app payment channel picker.
// Usage: bun run scripts/verify-channel-picker.ts
import { chromium } from 'playwright'

const BASE = 'https://martup-seven.vercel.app'
const EMAIL_INPUT = 'input[placeholder*="contoh@email.com"]'
const PASS_INPUT = 'input[type="password"]'

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })

  // 1. Onboarding (first visit) → Skip → Login
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  const skip = page.locator('button:has-text("Skip")').first()
  if (await skip.count()) { await skip.click(); await page.waitForTimeout(2500) }

  // If not on login screen, go there via bottom nav profile or ?screen=login
  if (!(await page.locator(EMAIL_INPUT).count())) {
    await page.goto(`${BASE}/?screen=login`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
  }
  await page.waitForSelector(EMAIL_INPUT, { timeout: 15000 })
  await page.fill(EMAIL_INPUT, 'buyer@martup.com')
  await page.fill(PASS_INPUT, 'password123')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(5000)
  const bodyAfterLogin = (await page.locator('body').innerText()).slice(0, 120).replace(/\n+/g, ' | ')
  console.log('after login body:', bodyAfterLogin)

  // 2. Navigate to Top-Up via home banner icon
  const topUpEntry = page.locator('text=Top-Up').first()
  if (await topUpEntry.count()) {
    await topUpEntry.click()
    console.log('clicked Top-Up on home')
    await page.waitForTimeout(2500)
  } else {
    console.log('WARN: Top-Up entry not found on home')
  }

  // 3. On deposit screen pick 50K
  const bodyDeposit = (await page.locator('body').innerText()).slice(0, 200).replace(/\n+/g, ' | ')
  console.log('deposit body:', bodyDeposit)
  const amountBtn = page.locator('button:has-text("50K")').first()
  if (await amountBtn.count()) {
    await amountBtn.click()
    console.log('clicked 50K amount')
  } else {
    console.log('WARN: 50K quick amount not found')
  }

  // 4. Wait for channels (debounce 500ms + fetch)
  await page.waitForTimeout(3500)
  const hasPicker = (await page.locator('text=Pilih Channel Pembayaran').first().count()) > 0
  console.log('PICKER visible:', hasPicker)

  if (hasPicker) {
    const ovoRow = page.locator('button:has-text("OVO")').first()
    const hasOvo = (await ovoRow.count()) > 0
    console.log('OVO row found:', hasOvo)
    if (hasOvo) {
      await ovoRow.click()
      await page.waitForTimeout(600)
      console.log('SELECTED OVO — hint shown:', (await page.locator('text=Dibuka langsung').first().count()) > 0)
    }
    console.log('QRIS group listed:', (await page.locator('text=QRIS').first().count()) > 0)
    console.log('VA group listed:', (await page.locator('text=Virtual Account').first().count()) > 0)
    console.log('Default option listed:', (await page.locator('text=Semua Metode').first().count()) > 0)
    console.log('Channel logos rendered:', (await page.locator('img[alt]').count()) > 0)
  }

  await page.screenshot({ path: '/tmp/picker-deposit.png', fullPage: true })
  console.log('CONSOLE/PAGE ERRORS:', errors.length === 0 ? 'NONE' : errors.slice(0, 6))
  await browser.close()
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
