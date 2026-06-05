import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.message));

  const R = {};

  // T1
  console.log('T1: Home loads');
  const resp = await page.goto(BASE, { timeout: 60000 });
  await page.waitForTimeout(4000);
  R.t1_status = resp.status();
  R.t1 = resp.status() === 200;
  await page.screenshot({ path: '/tmp/s1-home.png' });

  // T2
  console.log('T2: Toggle visible');
  const t = await page.textContent('body');
  R.t2 = t.includes('Semua') && t.includes('Barang') && t.includes('Tolong Mas');

  // T3
  console.log('T3: Click Barang');
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Barang') && b.textContent?.includes('📦'))?.click());
  await page.waitForTimeout(1200);
  const t3 = await page.textContent('body');
  R.t3 = t3.includes('📦 Barang');
  await page.screenshot({ path: '/tmp/s2-barang.png' });

  // T4
  console.log('T4: Click Tolong Mas');
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Tolong Mas') && b.textContent?.includes('🤝'))?.click());
  await page.waitForTimeout(1200);
  const t4 = await page.textContent('body');
  R.t4 = t4.includes('🤝 Tolong Mas') && t4.includes('Belum Ada Layanan Tolong Mas');
  R.t4_header = t4.includes('🤝 Tolong Mas');
  R.t4_empty = t4.includes('Belum Ada Layanan Tolong Mas');
  R.t4_sub = t4.includes('Layanan Tolong Mas akan muncul');
  await page.screenshot({ path: '/tmp/s3-tolongmas.png' });

  // T5
  console.log('T5: Click Semua');
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Semua') && b.textContent?.includes('🔥'))?.click());
  await page.waitForTimeout(1200);
  const t5 = await page.textContent('body');
  R.t5 = t5.includes('Rekomendasi Untukmu');
  await page.screenshot({ path: '/tmp/s4-semua.png' });

  // T6
  console.log('T6: Search screen');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      const r = b.getBoundingClientRect();
      if (b.closest('.sticky') && r.width > 80 && r.height < 50 && b.querySelector('svg')) {
        b.click(); return;
      }
    }
  });
  await page.waitForTimeout(2000);
  const si = await page.locator('input[placeholder*="Cari"]').count();
  if (si > 0) {
    await page.locator('input[placeholder*="Cari"]').first().fill('test');
    await page.waitForTimeout(2000);
    const t6 = await page.textContent('body');
    R.t6 = (t6.includes('📦') || t6.includes('🤝')) && t6.includes('Semua');
    R.t6_details = { emoji: t6.includes('📦') || t6.includes('🤝'), semua: t6.includes('Semua'), filter: t6.includes('Filter') };
    await page.screenshot({ path: '/tmp/s5-search.png' });
  } else {
    R.t6 = false; R.t6_error = 'no search input';
  }

  R.errors = consoleErrors.slice(0, 15);
  R.pageErrors = pageErrors.slice(0, 5);
  await browser.close();
  console.log(JSON.stringify(R, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
