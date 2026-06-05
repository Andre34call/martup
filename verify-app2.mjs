import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  const results = {};

  // TEST 1: Home page loads
  console.log('\n=== TEST 1: Home page loads ===');
  try {
    const response = await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000); // wait for hydration
    results.homePageStatus = response.status();
    results.homePageTitle = await page.title();
    results.test1_pass = response.status() === 200;
    console.log(`Status: ${response.status()}, Title: ${results.homePageTitle}`);
  } catch (err) {
    results.test1_pass = false;
    results.test1_error = err.message;
    console.log(`ERROR: ${err.message}`);
  }

  // TEST 2: Toggle visible
  console.log('\n=== TEST 2: Toggle visible ===');
  try {
    const pageText = await page.textContent('body');
    const hasSemua = pageText.includes('Semua');
    const hasBarang = pageText.includes('Barang');
    const hasTolongMas = pageText.includes('Tolong Mas');
    results.test2_pass = hasSemua && hasBarang && hasTolongMas;
    results.toggleSemua = hasSemua;
    results.toggleBarang = hasBarang;
    results.toggleTolongMas = hasTolongMas;
    console.log(`Semua: ${hasSemua}, Barang: ${hasBarang}, Tolong Mas: ${hasTolongMas}`);
  } catch (err) {
    results.test2_pass = false;
    results.test2_error = err.message;
  }

  // TEST 3: Click Barang
  console.log('\n=== TEST 3: Click Barang ===');
  try {
    // Find the Barang button in the toggle
    const barangBtns = await page.locator('button').all();
    let barangBtn = null;
    for (const btn of barangBtns) {
      const text = await btn.textContent();
      if (text && text.includes('Barang') && text.includes('📦')) {
        barangBtn = btn;
        break;
      }
    }
    if (barangBtn) {
      await barangBtn.click();
      await page.waitForTimeout(1500);
      
      const pageText = await page.textContent('body');
      const hasBarangHeader = pageText.includes('📦 Barang');
      const hasBarangSubtitle = pageText.includes('Produk fisik dikirim ke rumahmu');
      results.test3_pass = hasBarangHeader;
      results.barangHeaderVisible = hasBarangHeader;
      results.barangSubtitleVisible = hasBarangSubtitle;
      console.log(`Barang header: ${hasBarangHeader}, subtitle: ${hasBarangSubtitle}`);
    } else {
      results.test3_pass = false;
      results.test3_error = 'Barang button not found';
    }
  } catch (err) {
    results.test3_pass = false;
    results.test3_error = err.message;
  }

  // TEST 4: Click Tolong Mas
  console.log('\n=== TEST 4: Click Tolong Mas ===');
  try {
    const btns = await page.locator('button').all();
    let tolongMasBtn = null;
    for (const btn of btns) {
      const text = await btn.textContent();
      if (text && text.includes('Tolong Mas') && text.includes('🤝')) {
        tolongMasBtn = btn;
        break;
      }
    }
    if (tolongMasBtn) {
      await tolongMasBtn.click();
      await page.waitForTimeout(1500);

      const pageText = await page.textContent('body');
      const hasTolongMasHeader = pageText.includes('🤝 Tolong Mas');
      const hasEmptyState = pageText.includes('Belum Ada Layanan Tolong Mas');
      const hasEmptySubtitle = pageText.includes('Layanan Tolong Mas akan muncul');
      results.test4_pass = hasTolongMasHeader && hasEmptyState;
      results.tolongMasHeader = hasTolongMasHeader;
      results.tolongMasEmptyState = hasEmptyState;
      results.tolongMasEmptySubtitle = hasEmptySubtitle;
      console.log(`Header: ${hasTolongMasHeader}, Empty: ${hasEmptyState}, Subtitle: ${hasEmptySubtitle}`);
    } else {
      results.test4_pass = false;
      results.test4_error = 'Tolong Mas button not found';
    }
  } catch (err) {
    results.test4_pass = false;
    results.test4_error = err.message;
  }

  // TEST 5: Click Semua
  console.log('\n=== TEST 5: Click Semua ===');
  try {
    const btns = await page.locator('button').all();
    let semuBtn = null;
    for (const btn of btns) {
      const text = await btn.textContent();
      if (text && text.trim() === '🔥Semua' || (text && text.includes('Semua') && text.includes('🔥'))) {
        semuBtn = btn;
        break;
      }
    }
    if (!semuBtn) {
      // Try a broader match
      for (const btn of btns) {
        const text = await btn.textContent();
        if (text && text.includes('Semua')) {
          semuBtn = btn;
          break;
        }
      }
    }
    if (semuBtn) {
      await semuBtn.click();
      await page.waitForTimeout(1500);

      const pageText = await page.textContent('body');
      const hasRekomendasi = pageText.includes('Rekomendasi Untukmu');
      results.test5_pass = hasRekomendasi;
      results.semuaHeader = hasRekomendasi;
      console.log(`Rekomendasi Untukmu visible: ${hasRekomendasi}`);
    } else {
      results.test5_pass = false;
      results.test5_error = 'Semua button not found';
    }
  } catch (err) {
    results.test5_pass = false;
    results.test5_error = err.message;
  }

  // TEST 6: Search screen filters
  console.log('\n=== TEST 6: Search screen filters ===');
  try {
    // Click the search bar to navigate to search
    // The search bar is a button with Search icon in the top bar
    const searchArea = page.locator('button').filter({ hasText: /Cari|Search/ }).first();
    // Actually, let's find the search bar in the sticky header area
    // It's a button with Search SVG icon inside
    await page.evaluate(() => {
      // Find the search button in the top bar and click it
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        // The search button in home has Search icon and is in the top bar
        if (btn.closest('.sticky') && btn.querySelector('svg')) {
          const text = btn.textContent || '';
          if (!text.trim() || text.includes('Cari')) {
            btn.click();
            return true;
          }
        }
      }
      // Fallback: click any search-like button
      for (const btn of buttons) {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 100 && rect.height < 50 && btn.closest('.sticky')) {
          btn.click();
          return true;
        }
      }
      return false;
    });
    await page.waitForTimeout(2000);

    // Check if we're on the search screen
    const searchInput = await page.locator('input').count();
    console.log(`Search inputs found: ${searchInput}`);

    if (searchInput > 0) {
      // Type a query
      await page.locator('input').first().fill('test');
      await page.waitForTimeout(2000);

      // Check for product type filter buttons (Semua, 📦, 🤝)
      const pageText = await page.textContent('body');
      const hasSemuaFilter = pageText.includes('Semua');
      const hasBarangEmoji = pageText.includes('📦');
      const hasTolongMasEmoji = pageText.includes('🤝');
      
      // Check for filter bar
      const filterBtn = await page.locator('button:has-text("Filter")').count();
      const sortBtn = await page.locator('button:has-text("Relevan")').count();

      results.searchScreen = {
        hasSemuaFilter,
        hasBarangEmoji,
        hasTolongMasEmoji,
        filterBtnCount: filterBtn,
        sortBtnCount: sortBtn,
      };
      results.test6_pass = hasSemuaFilter && hasBarangEmoji && hasTolongMasEmoji;
      console.log(`Filters - Semua: ${hasSemuaFilter}, 📦: ${hasBarangEmoji}, 🤝: ${hasTolongMasEmoji}`);
    } else {
      results.test6_pass = false;
      results.test6_error = 'Could not reach search screen';
    }
  } catch (err) {
    results.test6_pass = false;
    results.test6_error = err.message;
  }

  // Screenshots
  console.log('\n=== Screenshots ===');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/home-semua.png', fullPage: false });
    
    // Click Barang
    const btns1 = await page.locator('button').all();
    for (const btn of btns1) {
      const text = await btn.textContent();
      if (text && text.includes('Barang') && text.includes('📦')) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/home-barang.png', fullPage: false });

    // Click Tolong Mas
    const btns2 = await page.locator('button').all();
    for (const btn of btns2) {
      const text = await btn.textContent();
      if (text && text.includes('Tolong Mas') && text.includes('🤝')) {
        await btn.click();
        break;
      }
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/home-tolong-mas.png', fullPage: false });

    results.screenshots_taken = true;
  } catch (err) {
    results.screenshots_taken = false;
    results.screenshots_error = err.message;
  }

  results.consoleErrors = consoleErrors.slice(0, 20);
  results.pageErrors = pageErrors.slice(0, 10);

  await browser.close();

  console.log('\n\n========================================');
  console.log('         VERIFICATION RESULTS           ');
  console.log('========================================');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
