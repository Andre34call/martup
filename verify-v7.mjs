import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  
  // Pre-set auth state before loading page
  await context.addCookies([
    { name: 'martup_auth', value: '1', domain: 'localhost', path: '/' },
  ]);
  await context.addInitScript(() => {
    localStorage.setItem('authToken', 'mock');
    localStorage.setItem('martup-storage', JSON.stringify({
      state: { settings: { theme: 'light' }, searchHistory: [] },
      version: 2
    }));
  });
  
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.message));

  const R = {};

  // T1: Load page
  console.log('T1: Page loads');
  const resp = await page.goto('http://localhost:3000', { timeout: 30000 });
  await page.waitForTimeout(5000); // Wait for full hydration
  R.t1 = resp.status() === 200;
  R.t1_status = resp.status();

  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Body text (first 1000):', bodyText.substring(0, 1000));
  
  R.showsHome = bodyText.includes('Semua') && bodyText.includes('Barang') && bodyText.includes('Tolong Mas');
  console.log('Shows home toggle:', R.showsHome);

  await page.screenshot({ path: '/tmp/s1-initial.png' });

  if (!R.showsHome) {
    // We might be on splash - click Skip
    console.log('Not on home, trying to skip onboarding...');
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const skipBtn = btns.find(b => b.textContent?.trim() === 'Skip');
      if (skipBtn) skipBtn.click();
    });
    await page.waitForTimeout(2000);
    
    // Now might be on login - try to navigate to home by manipulating store
    const body2 = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    console.log('After skip:', body2.substring(0, 500));
    
    // Try to access and manipulate the Zustand store
    const storeResult = await page.evaluate(() => {
      // In Next.js with Turbopack, we can try to find the zustand store
      // through the module system or through React internals
      
      // Method: find the React root and walk the fiber tree
      const container = document.querySelector('[data-reactroot]') || document.getElementById('__next');
      if (!container) return 'no container';
      
      // Find React internal instance
      const key = Object.keys(container).find(k => 
        k.startsWith('__reactInternalInstance') || k.startsWith('__reactFiber')
      );
      if (!key) return 'no fiber key';
      
      // The store should be accessible through the component tree
      // Let's try a different approach: use the zustand store's API
      // which is exposed through the persist middleware
      
      // Actually, let's try calling the navigate function through
      // a global event dispatch approach
      return 'fiber found: ' + key;
    });
    console.log('Store result:', storeResult);
    
    // Method: Force navigate by manipulating the page's JavaScript context
    // We need to find the zustand store reference
    const navAttempt = await page.evaluate(() => {
      // Try to find the useAppStore in the module scope
      // In Next.js dev, modules are loaded via Turbopack
      // We can try to find them in the window scope
      
      // The store should be accessible somewhere in the module cache
      // Let's search for it
      for (const key of Object.keys(window)) {
        if (key.includes('zustand') || key.includes('store') || key.includes('martup')) {
          // Found something
        }
      }
      
      // Alternative: try to simulate a login by creating a session
      // and then reloading
      return 'searched window';
    });
    console.log('Nav attempt:', navAttempt);
    
    // Nuclear option: bypass the entire auth system by 
    // directly manipulating the Zustand store via page.addScriptTag
    await page.addScriptTag({
      content: `
        // This script runs in the page context
        // Try to find and call the zustand store
        window.__forceNavigate = function(screen) {
          // Walk all script modules to find the store
          // In Turbopack, we might find it through __turbopack_load__
          console.log('Force navigate called with:', screen);
        };
      `
    });
    
    // Let's try another approach: use the /api/seed endpoint to seed data
    // and then use the test credentials
    console.log('Trying seed API...');
    const seedResult = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/seed', { method: 'POST' });
        return { status: res.status, data: await res.text().then(t => t.substring(0, 500)) };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('Seed result:', JSON.stringify(seedResult));
  }

  // If we're on login screen, try to access the app by manipulating the store directly
  // through the React component's internal state
  const finalCheck = await page.evaluate(() => {
    const text = document.body.innerText;
    const buttons = [...document.querySelectorAll('button')].map(b => b.textContent?.trim()).filter(Boolean);
    const links = [...document.querySelectorAll('a')].map(a => a.textContent?.trim()).filter(Boolean);
    return { 
      text: text.substring(0, 500), 
      buttons: buttons.slice(0, 20),
      links: links.slice(0, 10)
    };
  });
  console.log('Final page state:', JSON.stringify(finalCheck, null, 2));

  R.errors = consoleErrors.slice(0, 10);
  R.pageErrors = pageErrors.slice(0, 5);
  await browser.close();
  console.log('\nFINAL:');
  console.log(JSON.stringify(R, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
