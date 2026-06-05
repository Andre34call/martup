import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  const results = {};

  // TEST 1: Home page loads
  console.log('TEST 1: Home page loads');
  try {
    const response = await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
    results.homePageStatus = response.status();
    results.test1_pass = response.status() === 200;
    console.log('Status:', response.status());
  } catch (err) {
    results.test1_pass = false;
    results.test1_error = err.message;
    console.log('ERROR:', err.message);
  }

  if (!results.test1_pass) {
    console.log('Cannot proceed - server not reachable');
    results.consoleErrors = consoleErrors;
    results.pageErrors = pageErrors;
    await browser.close();
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Screenshot: Home page initial
  await page.screenshot({ path: '/tmp/home-initial.png' });

  // TEST 2: Toggle visible
  console.log('TEST 2: Toggle visible');
  try {
    const bodyText = await page.textContent('body');
    const hasSemua = bodyText.includes('Semua');
    const hasBarang = bodyText.includes('Barang');
    const hasTolongMas = bodyText.includes('Tolong Mas');
    results.test2_pass = hasSemua && hasBarang && hasTolongMas;
    results.toggleSemua = hasSemua;
    results.toggleBarang = hasBarang;
    results.toggleTolongMas = hasTolongMas;
    console.log('Toggle - Semua:', hasSemua, 'Barang:', hasBarang, 'Tolong Mas:', hasTolongMas);
  } catch (err) {
    results.test2_pass = false;
    results.test2_error = err.message;
  }

  // TEST 3: Click Barang
  console.log('TEST 3: Click Barang');
  try {
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent && btn.textContent.includes('Barang') && btn.textContent.includes('📦')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    await page.waitForTimeout(1500);
    const bodyText = await page.textContent('body');
    results.test3_pass = bodyText.includes('📦 Barang');
    results.barangHeader = bodyText.includes('📦 Barang');
    results.barangSubtitle = bodyText.includes('Produk fisik dikirim ke rumahmu');
    console.log('Barang header:', results.barangHeader, 'subtitle:', results.barangSubtitle);
    await page.screenshot({ path: '/tmp/home-barang.png' });
  } catch (err) {
    results.test3_pass = false;
    results.test3_error = err.message;
  }

  // TEST 4: Click Tolong Mas
  console.log('TEST 4: Click Tolong Mas');
  try {
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent && btn.textContent.includes('Tolong Mas') && btn.textContent.includes('🤝')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    await page.waitForTimeout(1500);
    const bodyText = await page.textContent('body');
    results.test4_pass = bodyText.includes('🤝 Tolong Mas') && bodyText.includes('Belum Ada Layanan Tolong Mas');
    results.tolongMasHeader = bodyText.includes('🤝 Tolong Mas');
    results.tolongMasEmpty = bodyText.includes('Belum Ada Layanan Tolong Mas');
    results.tolongMasSubtitle = bodyText.includes('Layanan Tolong Mas akan muncul');
    console.log('Tolong Mas header:', results.tolongMasHeader, 'empty:', results.tolongMasEmpty);
    await page.screenshot({ path: '/tmp/home-tolong-mas.png' });
  } catch (err) {
    results.test4_pass = false;
    results.test4_error = err.message;
  }

  // TEST 5: Click Semua
  console.log('TEST 5: Click Semua');
  try {
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent && btn.textContent.includes('Semua') && btn.textContent.includes('🔥')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    await page.waitForTimeout(1500);
    const bodyText = await page.textContent('body');
    results.test5_pass = bodyText.includes('Rekomendasi Untukmu');
    console.log('Rekomendasi Untukmu visible:', results.test5_pass);
    await page.screenshot({ path: '/tmp/home-semua.png' });
  } catch (err) {
    results.test5_pass = false;
    results.test5_error = err.message;
  }

  // TEST 6: Search screen filters
  console.log('TEST 6: Search screen');
  try {
    // Navigate to search by clicking the search bar button
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      // The search bar in home is a button inside the sticky header
      for (const btn of buttons) {
        const parent = btn.closest('.sticky');
        if (parent && btn.querySelector('svg') && !btn.textContent.trim()) {
          btn.click();
          return true;
        }
      }
      // Fallback: look for a wide button in the sticky area
      for (const btn of buttons) {
        const parent = btn.closest('.sticky');
        const rect = btn.getBoundingClientRect();
        if (parent && rect.width > 80 && rect.height < 45) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    await page.waitForTimeout(2000);

    const searchInput = await page.locator('input[placeholder*="Cari"]').count();
    if (searchInput > 0) {
      await page.locator('input[placeholder*="Cari"]').first().fill('test');
      await page.waitForTimeout(2000);
      
      const bodyText = await page.textContent('body');
      const hasFilterBtn = bodyText.includes('Filter');
      const hasSemua = bodyText.includes('Semua');
      const hasEmoji = bodyText.includes('📦') || bodyText.includes('🤝');
      
      results.searchScreen = { hasFilterBtn, hasSemua, hasEmoji };
      results.test6_pass = hasSemua && hasEmoji;
      console.log('Search screen - Filter:', hasFilterBtn, 'Semua:', hasSemua, 'Emoji:', hasEmoji);
      await page.screenshot({ path: '/tmp/search-screen.png' });
    } else {
      results.test6_pass = false;
      results.test6_error = 'Search input not found';
      console.log('Search input not found');
    }
  } catch (err) {
    results.test6_pass = false;
    results.test6_error = err.message;
  }

  results.consoleErrors = consoleErrors.slice(0, 20);
  results.pageErrors = pageErrors.slice(0, 10);

  await browser.close();
  console.log('\n========================================');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
