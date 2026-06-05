import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.message));

  const R = {};

  console.log('T1: Home loads');
  const resp = await page.goto('http://localhost:3000', { timeout: 30000 });
  await page.waitForTimeout(5000);
  R.t1_status = resp.status();
  R.t1 = resp.status() === 200;
  
  const bodyText = await page.evaluate(() => document.body.textContent.substring(0, 3000));
  console.log('BODY (first 2000):', bodyText.substring(0, 2000));
  
  await page.screenshot({ path: '/tmp/s1-initial.png' });
  
  R.showsHome = bodyText.includes('Semua') || bodyText.includes('Barang') || bodyText.includes('Tolong Mas');
  R.showsMartUp = bodyText.includes('MartUp');
  R.t2 = bodyText.includes('Semua') && bodyText.includes('Barang') && bodyText.includes('Tolong Mas');
  console.log('Shows Home:', R.showsHome, 'MartUp:', R.showsMartUp);

  if (!R.showsHome) {
    const allButtons = await page.evaluate(() => 
      [...document.querySelectorAll('button')].map(b => b.textContent?.trim()).filter(Boolean).slice(0, 30)
    );
    console.log('Buttons:', allButtons);
    console.log('URL:', page.url());
    
    // Try clicking through splash/onboarding
    // Look for a "Mulai" or "Lanjut" or "Masuk" button
    const clickResult = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      for (const b of btns) {
        const t = b.textContent?.trim();
        if (t === 'Mulai' || t === 'Lanjut' || t === 'Masuk' || t === 'Lewati' || t === 'Skip') {
          b.click();
          return t;
        }
      }
      // Try clicking any visible button
      for (const b of btns) {
        const t = b.textContent?.trim();
        if (t && t.length < 20) {
          b.click();
          return 'clicked: ' + t;
        }
      }
      return 'nothing found';
    });
    console.log('Click result:', clickResult);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/s-after-click.png' });
    
    const bodyText2 = await page.evaluate(() => document.body.textContent.substring(0, 3000));
    console.log('BODY after click:', bodyText2.substring(0, 2000));
    
    R.t2 = bodyText2.includes('Semua') && bodyText2.includes('Barang') && bodyText2.includes('Tolong Mas');
    R.showsHome2 = bodyText2.includes('Semua');
  }

  if (R.t2) {
    // T3: Click Barang
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Barang') && b.textContent?.includes('📦'))?.click());
    await page.waitForTimeout(1200);
    const t3 = await page.textContent('body');
    R.t3 = t3.includes('📦 Barang');
    R.t3_sub = t3.includes('Produk fisik dikirim ke rumahmu');
    await page.screenshot({ path: '/tmp/s2-barang.png' });
    console.log('T3:', R.t3);

    // T4: Click Tolong Mas
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Tolong Mas') && b.textContent?.includes('🤝'))?.click());
    await page.waitForTimeout(1200);
    const t4 = await page.textContent('body');
    R.t4 = t4.includes('🤝 Tolong Mas') && t4.includes('Belum Ada Layanan Tolong Mas');
    R.t4_header = t4.includes('🤝 Tolong Mas');
    R.t4_empty = t4.includes('Belum Ada Layanan Tolong Mas');
    R.t4_sub = t4.includes('Layanan Tolong Mas akan muncul');
    await page.screenshot({ path: '/tmp/s3-tolongmas.png' });
    console.log('T4:', R.t4);

    // T5: Click Semua
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Semua') && b.textContent?.includes('🔥'))?.click());
    await page.waitForTimeout(1200);
    const t5 = await page.textContent('body');
    R.t5 = t5.includes('Rekomendasi Untukmu');
    await page.screenshot({ path: '/tmp/s4-semua.png' });
    console.log('T5:', R.t5);

    // T6: Search screen
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
      R.t6 = t6.includes('Semua') && (t6.includes('📦') || t6.includes('🤝'));
      R.t6_filter = t6.includes('Filter');
      await page.screenshot({ path: '/tmp/s5-search.png' });
    } else {
      R.t6 = false; R.t6_err = 'no search input';
    }
    console.log('T6:', R.t6);
  }

  R.errors = consoleErrors.slice(0, 15);
  R.pageErrors = pageErrors.slice(0, 5);
  await browser.close();
  console.log('\nFINAL:');
  console.log(JSON.stringify(R, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
