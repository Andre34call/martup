import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 size
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const consoleWarnings = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    if (msg.type() === 'warning') consoleWarnings.push(msg.text());
  });

  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  const results = {};

  // ===================== TEST 1: Home page loads =====================
  console.log('\n=== TEST 1: Home page loads ===');
  try {
    const response = await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    results.homePageStatus = response.status();
    console.log(`Page status: ${response.status()}`);
    await page.waitForTimeout(3000); // wait for hydration
    results.homePageTitle = await page.title();
    console.log(`Page title: ${results.homePageTitle}`);
    results.test1_pass = response.status() === 200;
  } catch (err) {
    results.test1_pass = false;
    results.test1_error = err.message;
    console.log(`ERROR: ${err.message}`);
  }

  // ===================== TEST 2: Toggle visible =====================
  console.log('\n=== TEST 2: Toggle visible ===');
  try {
    // Look for the product type toggle buttons
    const toggleButtons = await page.locator('button:has-text("Semua"), button:has-text("Barang"), button:has-text("Tolong Mas")').all();
    results.toggleButtonsFound = toggleButtons.length;
    console.log(`Found ${toggleButtons.length} toggle buttons`);

    // Check specifically for the three toggle options
    const semuBtn = await page.locator('button:has-text("Semua")').count();
    const barangBtn = await page.locator('button:has-text("Barang")').count();
    const tolongMasBtn = await page.locator('button:has-text("Tolong Mas")').count();

    results.semuBtnCount = semuBtn;
    results.barangBtnCount = barangBtn;
    results.tolongMasBtnCount = tolongMasBtn;
    console.log(`Semua: ${semuBtn}, Barang: ${barangBtn}, Tolong Mas: ${tolongMasBtn}`);

    results.test2_pass = semuBtn > 0 && barangBtn > 0 && tolongMasBtn > 0;
  } catch (err) {
    results.test2_pass = false;
    results.test2_error = err.message;
    console.log(`ERROR: ${err.message}`);
  }

  // ===================== TEST 3: Click Barang =====================
  console.log('\n=== TEST 3: Click 📦 Barang ===');
  try {
    // Find and click the Barang button
    const barangButton = page.locator('button:has-text("Barang")').first();
    await barangButton.click();
    await page.waitForTimeout(1000);

    // Check section header changed
    const sectionHeader = await page.locator('text=📦 Barang').allTextContents();
    results.barangSectionHeaders = sectionHeader;
    console.log(`Section headers after Barang click: ${JSON.stringify(sectionHeader)}`);

    // Check that the "Semua" button is not selected (Barang should be selected)
    const barangBtnActive = await page.locator('button:has-text("Barang")').first().evaluate(el => {
      return el.classList.contains('bg-emerald-500') || el.className.includes('emerald');
    });
    results.barangBtnActive = barangBtnActive;
    console.log(`Barang button is active (emerald): ${barangBtnActive}`);

    // Count visible product cards
    const productCards = await page.locator('[class*="aspect-square"]').count();
    results.barangProductCards = productCards;
    console.log(`Product cards visible: ${productCards}`);

    results.test3_pass = barangBtnActive && sectionHeader.length > 0;
  } catch (err) {
    results.test3_pass = false;
    results.test3_error = err.message;
    console.log(`ERROR: ${err.message}`);
  }

  // ===================== TEST 4: Click Tolong Mas =====================
  console.log('\n=== TEST 4: Click 🤝 Tolong Mas ===');
  try {
    const tolongMasBtn = page.locator('button:has-text("Tolong Mas")').first();
    await tolongMasBtn.click();
    await page.waitForTimeout(1000);

    // Check section header changed
    const tolongMasHeader = await page.locator('text=🤝 Tolong Mas').allTextContents();
    results.tolongMasHeader = tolongMasHeader;
    console.log(`Section headers after Tolong Mas click: ${JSON.stringify(tolongMasHeader)}`);

    // Check for empty state
    const emptyState = await page.locator('text=Belum Ada Layanan Tolong Mas').count();
    results.tolongMasEmptyState = emptyState;
    console.log(`Empty state visible: ${emptyState > 0}`);

    // Check button is active (purple)
    const tolongMasBtnActive = await page.locator('button:has-text("Tolong Mas")').first().evaluate(el => {
      return el.classList.contains('bg-purple-500') || el.className.includes('purple');
    });
    results.tolongMasBtnActive = tolongMasBtnActive;
    console.log(`Tolong Mas button is active (purple): ${tolongMasBtnActive}`);

    results.test4_pass = tolongMasBtnActive && emptyState > 0;
  } catch (err) {
    results.test4_pass = false;
    results.test4_error = err.message;
    console.log(`ERROR: ${err.message}`);
  }

  // ===================== TEST 5: Click Semua =====================
  console.log('\n=== TEST 5: Click Semua ===');
  try {
    const semuBtn = page.locator('button:has-text("Semua")').first();
    await semuBtn.click();
    await page.waitForTimeout(1000);

    // Check section header changed back
    const rekomendasiHeader = await page.locator('text=Rekomendasi Untukmu').count();
    results.semuHeaderCount = rekomendasiHeader;
    console.log(`"Rekomendasi Untukmu" visible: ${rekomendasiHeader > 0}`);

    // Check button is active (gradient)
    const semuBtnActive = await page.locator('button:has-text("Semua")').first().evaluate(el => {
      return el.className.includes('gradient') || el.className.includes('emerald');
    });
    results.semuBtnActive = semuBtnActive;
    console.log(`Semua button is active: ${semuBtnActive}`);

    // Count visible product cards
    const productCards = await page.locator('[class*="aspect-square"]').count();
    results.semuProductCards = productCards;
    console.log(`Product cards visible: ${productCards}`);

    results.test5_pass = rekomendasiHeader > 0;
  } catch (err) {
    results.test5_pass = false;
    results.test5_error = err.message;
    console.log(`ERROR: ${err.message}`);
  }

  // ===================== TEST 6: Search screen product type filters =====================
  console.log('\n=== TEST 6: Search screen product type filters ===');
  try {
    // Click on the search bar to navigate to search screen
    const searchBar = page.locator('button:has(svg)').filter({ hasText: '' }).first();
    // Actually, let's look for the search area in the top bar
    // The home screen has a search button that navigates to search
    await page.locator('button').filter({ has: page.locator('svg') }).first().click();
    await page.waitForTimeout(500);

    // More direct: click the search bar area
    // The search bar is a button with Search icon
    const searchBtn = page.locator('.sticky button:has(svg)').first();
    await searchBtn.click().catch(() => {});
    await page.waitForTimeout(1000);

    // Try navigating by clicking the search input area in top bar
    const currentUrl = page.url();
    console.log(`Current URL after search click: ${currentUrl}`);

    // If not on search screen, try clicking the search bar area again
    if (!currentUrl.includes('search')) {
      // Try a different approach - the search bar in home screen is a button
      const searchInput = page.locator('[placeholder*="Cari"], button:has-text("Cari")').first();
      await searchInput.click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Now check if we're on the search screen - look for the search input
    const searchInputExists = await page.locator('input[placeholder*="Cari"]').count();
    console.log(`Search input found: ${searchInputExists > 0}`);

    if (searchInputExists > 0) {
      // Type a search query to trigger the filter bar
      await page.locator('input[placeholder*="Cari"]').fill('iPhone');
      await page.waitForTimeout(1500);

      // Check for product type filter buttons
      const productTypeFilters = await page.locator('button[title="Barang"], button[title="Tolong Mas"], button[title="Semua"]').count();
      console.log(`Product type filter buttons with title attr: ${productTypeFilters}`);

      // Also check for the emoji buttons in filter bar
      const emojiFilters = await page.locator('button:has-text("📦"), button:has-text("🤝")').count();
      console.log(`Emoji filter buttons: ${emojiFilters}`);

      // Check for Semua button in filter bar
      const semuaFilter = await page.locator('button:has-text("Semua")').count();
      console.log(`Semua filter buttons: ${semuaFilter}`);

      results.searchFilterBar = {
        productTypeFilters,
        emojiFilters,
        semuaFilter,
      };

      results.test6_pass = emojiFilters > 0 || productTypeFilters > 0;
    } else {
      results.test6_pass = false;
      results.test6_error = 'Search screen not reached';
    }
  } catch (err) {
    results.test6_pass = false;
    results.test6_error = err.message;
    console.log(`ERROR: ${err.message}`);
  }

  // ===================== SCREENSHOTS =====================
  console.log('\n=== Taking screenshots ===');
  try {
    // Go back to home for screenshot
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Screenshot with "Semua" selected
    await page.screenshot({ path: '/tmp/home-semua.png', fullPage: false });
    console.log('Screenshot: /tmp/home-semua.png');

    // Click Barang and screenshot
    await page.locator('button:has-text("Barang")').first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/home-barang.png', fullPage: false });
    console.log('Screenshot: /tmp/home-barang.png');

    // Click Tolong Mas and screenshot
    await page.locator('button:has-text("Tolong Mas")').first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/tmp/home-tolong-mas.png', fullPage: false });
    console.log('Screenshot: /tmp/home-tolong-mas.png');

    results.screenshots_taken = true;
  } catch (err) {
    results.screenshots_taken = false;
    results.screenshots_error = err.message;
    console.log(`Screenshot error: ${err.message}`);
  }

  // ===================== Console Errors =====================
  results.consoleErrors = consoleErrors;
  results.consoleWarnings = consoleWarnings.slice(0, 10); // limit
  results.pageErrors = pageErrors;

  await browser.close();

  // Print final results
  console.log('\n\n========================================');
  console.log('         VERIFICATION RESULTS           ');
  console.log('========================================');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
