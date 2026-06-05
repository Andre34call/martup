import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.message));

  const R = {};

  // T1: Load page
  console.log('T1: Page loads');
  const resp = await page.goto('http://localhost:3000', { timeout: 30000 });
  await page.waitForTimeout(4000);
  R.t1 = resp.status() === 200;
  R.t1_status = resp.status();
  console.log('Status:', resp.status());

  // Skip onboarding
  console.log('Skipping onboarding...');
  await page.evaluate(() => {
    const skipBtn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Skip');
    if (skipBtn) skipBtn.click();
  });
  await page.waitForTimeout(2000);

  // We should now be on login screen - bypass auth by setting Zustand state directly
  console.log('Bypassing auth via Zustand...');
  await page.evaluate(() => {
    const store = window.__ZUSTAND_STORE__ || null;
    // Try accessing the store via the exposed zustand API
    // In dev mode, we can use useAppStore from the module scope
    // Alternative: set localStorage to simulate a logged-in state
  });
  
  // Actually, let's try to navigate directly by manipulating the store
  // The store is persisted in localStorage as 'martup-storage'
  // Let's try a different approach - directly set the state via the module
  
  // Approach: inject a script that accesses the zustand store
  await page.evaluate(() => {
    // Set up a mock user by manipulating the store directly
    // Since the store is a module-level variable, we need to find it
    // The easiest way is to dispatch a custom event or use React internals
    
    // For now, let's try setting localStorage and reloading
    // The persist middleware stores state in 'martup-storage'
    const existingState = JSON.parse(localStorage.getItem('martup-storage') || '{}');
    existingState.state = existingState.state || {};
    // Don't persist currentScreen - it's not in partialize
    // But we can set the initial screen by manipulating the zustand store
    localStorage.setItem('martup-storage', JSON.stringify(existingState));
  });

  // Better approach: use React DevTools or window access to the store
  // Let's try accessing the store via the React tree
  const storeAccess = await page.evaluate(() => {
    // Access the zustand store - it's usually available via the module
    // Try to find it through React fiber
    const rootEl = document.getElementById('__next');
    if (!rootEl) return 'no root';
    
    // Walk the React fiber tree to find the store
    const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return 'no fiber';
    
    return 'found fiber';
  });
  console.log('Store access:', storeAccess);

  // Alternative: Let's just log in with the API
  console.log('Trying to log in via API...');
  const loginResult = await page.evaluate(async () => {
    try {
      // Try to register/login a test user
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'Test1234!' })
      });
      const data = await res.json();
      return { status: res.status, data };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('Login result:', JSON.stringify(loginResult));

  // If login succeeded, we need to refresh to pick up the session
  if (loginResult.status === 200 || loginResult.data?.success) {
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    // Check if we're on home screen now
    const bodyText = await page.evaluate(() => document.body.textContent.substring(0, 2000));
    R.showsHome = bodyText.includes('Semua') || bodyText.includes('Barang');
    console.log('After login - shows home:', R.showsHome);
  }

  // Alternative: Try to directly manipulate the Zustand store to navigate to home
  // and set a mock user
  console.log('Trying direct store manipulation...');
  
  // Set auth cookie and navigate
  await page.evaluate(() => {
    // Set a mock auth cookie
    document.cookie = 'martup_auth=1; path=/; max-age=86400';
    document.cookie = 'authToken=mock-token; path=/; max-age=86400';
    localStorage.setItem('authToken', 'mock-token');
  });

  // Now try to set the zustand store state directly
  await page.evaluate(() => {
    // The zustand store API is accessible via the hook
    // We can use useAppStore.getState() from within a component
    // But from outside, we need to find the store reference
    
    // Try to find it in the window scope
    // Some apps expose it, some don't
    // Let's try setting the state via the persist middleware's storage
    const storageKey = 'martup-storage';
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{"state":{}}');
    // We can't persist currentScreen, but we can try to access the store at runtime
    
    // Try to find and call the store's setState
    // In dev mode, zustand stores are sometimes accessible
  });

  // Let me try a completely different approach - navigate programmatically
  // by finding and using the navigate function from the React tree
  const navResult = await page.evaluate(() => {
    // Find all React fiber roots
    const rootEl = document.getElementById('__next');
    if (!rootEl) return 'no root';
    
    // Access zustand store through the module
    // In Next.js with turbopack, modules are scoped
    // Let's try using __NEXT_DATA__ or similar
    
    // Actually, the simplest approach: click through the UI
    // 1. We're on login screen - let's see what's there
    const buttons = [...document.querySelectorAll('button')].map(b => b.textContent?.trim());
    const inputs = [...document.querySelectorAll('input')].map(i => ({ type: i.type, placeholder: i.placeholder }));
    return { buttons, inputs };
  });
  console.log('Login screen elements:', JSON.stringify(navResult));

  // Try filling in login form and submitting
  try {
    const emailInput = page.locator('input[type="email"], input[placeholder*="Email"], input[placeholder*="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[placeholder*="Password"]').first();
    
    if (await emailInput.count() > 0) {
      await emailInput.fill('test@test.com');
      await passwordInput.fill('Test1234!');
      
      // Click login button
      const loginBtn = page.locator('button:has-text("Masuk")').first();
      await loginBtn.click();
      await page.waitForTimeout(3000);
      
      const afterLogin = await page.evaluate(() => document.body.textContent.substring(0, 2000));
      console.log('After login attempt:', afterLogin.substring(0, 500));
      
      R.showsHome = afterLogin.includes('Semua') || afterLogin.includes('Barang') || afterLogin.includes('MartUp');
    }
  } catch (e) {
    console.log('Login form interaction error:', e.message);
  }

  // Final: force navigation to home via zustand store direct access
  // The key insight: we can access the store via the exposed __ZUSTAND_STORE__ 
  // or by finding it in the React component tree
  const forceNav = await page.evaluate(() => {
    // Try to find the store through React internals
    // In zustand, the store is created at module level
    // We can access it if we find the right React component
    
    // Alternative: dispatch a custom event that the app listens for
    // Or: directly modify the DOM to simulate the home screen
    
    // Let's try the most direct approach: use the zustand store from the page context
    // The store should be accessible via the module's exports
    
    // In Next.js dev mode, we can try to access modules via webpack/turbopack
    // __webpack_require__ or __turbopack_require__
    
    // Simplest: just call the store's navigate function
    // We need to find a way to call useAppStore.getState().navigate('home')
    
    // Try: set the state via the persist rehydration
    // The persist middleware reads from localStorage on page load
    // But currentScreen is not persisted...
    
    return 'attempted';
  });

  // Nuclear option: inject a script tag that imports the store
  const injectResult = await page.evaluate(() => {
    // The store is available as a module in the Next.js bundle
    // We can try to access it through the global chunk registry
    try {
      // Check if __turbopack_context__ is available
      if (typeof window.__turbopack_context__ !== 'undefined') {
        return 'turbopack context available';
      }
      
      // Check for __next_f (Next.js flight data)
      if (typeof window.__next_f !== 'undefined') {
        return 'next_f available';
      }
      
      // Try to access the store by finding a React component that uses it
      // and reading its state
      return 'no direct access found';
    } catch (e) {
      return e.message;
    }
  });
  console.log('Inject result:', injectResult);

  // Let's try the most practical approach: register a user via the API, then log in
  console.log('Trying to register and login...');
  
  // First register
  const regResult = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: 'Test User', 
          email: 'testuser@martup.com', 
          password: 'Test1234!',
          phone: '081234567890'
        })
      });
      return { status: res.status, data: await res.json() };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('Register result:', JSON.stringify(regResult));

  // Then login
  const loginResult2 = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: 'testuser@martup.com', 
          password: 'Test1234!'
        })
      });
      const data = await res.json();
      return { status: res.status, ok: res.ok, hasToken: !!data.token || !!data.accessToken, data: JSON.stringify(data).substring(0, 500) };
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('Login result 2:', JSON.stringify(loginResult2));

  // If login worked, reload page
  if (loginResult2.ok) {
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    
    const bodyText = await page.evaluate(() => document.body.textContent.substring(0, 3000));
    R.showsHome = bodyText.includes('Semua') || bodyText.includes('Barang') || bodyText.includes('Tolong Mas');
    console.log('After auth - shows home:', R.showsHome);
    console.log('Body (first 500):', bodyText.substring(0, 500));
    
    await page.screenshot({ path: '/tmp/s-after-auth.png' });
  }

  R.errors = consoleErrors.slice(0, 15);
  R.pageErrors = pageErrors.slice(0, 5);
  await browser.close();
  console.log('\nFINAL:');
  console.log(JSON.stringify(R, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
