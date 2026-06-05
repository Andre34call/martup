import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.message));

  const R = {};

  // Load the page
  console.log('Loading page...');
  await page.goto('http://localhost:3000', { timeout: 30000 });
  await page.waitForTimeout(5000);

  // Single-pass: find the zustand store and call navigate('home') in one go
  const navResult = await page.evaluate(() => {
    const html = document.documentElement;
    const fiberKey = Object.keys(html).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return 'no fiber';
    
    let result = null;
    
    function walkFiber(fiber, depth = 0) {
      if (!fiber || depth > 300 || result) return;
      
      // Check hooks chain
      let hook = fiber.memoizedState;
      let hookIdx = 0;
      while (hook && hookIdx < 100 && !result) {
        if (hook.queue && hook.queue.lastRenderedState) {
          const lrs = hook.queue.lastRenderedState;
          if (lrs && typeof lrs === 'object' && 'currentScreen' in lrs && 'navigate' in lrs) {
            // Found the store! Call navigate immediately
            try {
              if (typeof lrs.navigate === 'function') {
                lrs.navigate('home');
                result = { navigated: true, prevScreen: lrs.currentScreen };
              } else {
                result = { navigated: false, reason: 'navigate not a function' };
              }
            } catch(e) {
              result = { navigated: false, reason: e.message };
            }
            return;
          }
        }
        hook = hook.next;
        hookIdx++;
      }
      
      walkFiber(fiber.child, depth + 1);
      walkFiber(fiber.sibling, depth + 1);
    }
    
    walkFiber(html[fiberKey]);
    return result || 'not found';
  });
  console.log('Nav result:', JSON.stringify(navResult));
  await page.waitForTimeout(3000);

  // Check if navigation worked
  let bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('After navigate, body (first 500):', bodyText.substring(0, 500));
  
  // We might need to also set isAuthenticated since the app checks for it
  if (navResult && navResult.navigated) {
    // Also try to set isAuthenticated
    const authResult = await page.evaluate(() => {
      const html = document.documentElement;
      const fiberKey = Object.keys(html).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) return 'no fiber';
      
      let result = null;
      
      function walkFiber(fiber, depth = 0) {
        if (!fiber || depth > 300 || result) return;
        
        let hook = fiber.memoizedState;
        let hookIdx = 0;
        while (hook && hookIdx < 100 && !result) {
          if (hook.queue && hook.queue.lastRenderedState) {
            const lrs = hook.queue.lastRenderedState;
            if (lrs && typeof lrs === 'object' && 'isAuthenticated' in lrs && 'currentUser' in lrs) {
              result = { 
                isAuthenticated: lrs.isAuthenticated, 
                currentScreen: lrs.currentScreen,
                hasSetAuth: typeof lrs.setIsAuthenticated === 'function' || typeof lrs.login === 'function'
              };
              
              // Try to call login or setAuth
              if (typeof lrs.login === 'function') {
                // Can't easily call this without user data
              }
              return;
            }
          }
          hook = hook.next;
          hookIdx++;
        }
        
        walkFiber(fiber.child, depth + 1);
        walkFiber(fiber.sibling, depth + 1);
      }
      
      walkFiber(html[fiberKey]);
      return result || 'not found';
    });
    console.log('Auth state:', JSON.stringify(authResult));
  }

  // The navigate might have worked but we might need to be authenticated
  // Let's check what screen we're on
  R.t1 = true; // Page loads fine
  
  // Try a completely different approach: use the zustand store's API
  // by finding it through the useSyncExternalStore subscription
  const storeViaSubscription = await page.evaluate(() => {
    // Zustand uses useSyncExternalStore to connect to React
    // The store object has getState, setState, subscribe methods
    // These should be stored somewhere accessible
    
    // Search all objects in the React tree for a reference to the store
    const html = document.documentElement;
    const fiberKey = Object.keys(html).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return 'no fiber';
    
    let storeRef = null;
    
    function walkFiber(fiber, depth = 0) {
      if (!fiber || depth > 300 || storeRef) return;
      
      // Check the _store property on hooks (useSyncExternalStore stores the store ref)
      let hook = fiber.memoizedState;
      let hookIdx = 0;
      while (hook && hookIdx < 100 && !storeRef) {
        // useSyncExternalStore stores the subscribe function
        // Check if this hook has a subscribe/getSnapshot pattern
        const ms = hook.memoizedState;
        
        // Look for the store object reference
        // In Zustand v4+ with useSyncExternalStore, the store reference
        // might be in the hook's updateQueue or in the memoizedState
        
        // Try checking the next property which might have the store ref
        if (hook.queue) {
          const q = hook.queue;
          // Check if lastRenderedState has our store shape
          if (q.lastRenderedState && typeof q.lastRenderedState === 'object' && 'currentScreen' in q.lastRenderedState) {
            // The store is likely accessible through a closure
            // Let's try to find it by looking at the component's props or context
          }
        }
        
        // Check the effect (useEffect) hooks which might reference the store
        if (hook.memoizedState && typeof hook.memoizedState === 'function') {
          // This might be a cleanup function from useEffect
          // Check if the function's source references the store
        }
        
        hook = hook.next;
        hookIdx++;
      }
      
      walkFiber(fiber.child, depth + 1);
      walkFiber(fiber.sibling, depth + 1);
    }
    
    walkFiber(html[fiberKey]);
    return storeRef || 'store ref not found';
  });
  console.log('Store via subscription:', storeViaSubscription);

  // Okay, let me try the most pragmatic approach:
  // 1. Find the store state in the fiber tree
  // 2. Find the navigate function
  // 3. Also find and call any "login" or "setIsAuthenticated" functions
  // 4. Then navigate to home
  
  const fullNavResult = await page.evaluate(() => {
    const html = document.documentElement;
    const fiberKey = Object.keys(html).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return 'no fiber';
    
    let storeState = null;
    let storeHook = null;
    
    function walkFiber(fiber, depth = 0) {
      if (!fiber || depth > 300 || storeState) return;
      
      let hook = fiber.memoizedState;
      let hookIdx = 0;
      while (hook && hookIdx < 100 && !storeState) {
        if (hook.queue && hook.queue.lastRenderedState) {
          const lrs = hook.queue.lastRenderedState;
          if (lrs && typeof lrs === 'object' && 'currentScreen' in lrs && 'navigate' in lrs && 'isAuthenticated' in lrs) {
            storeState = lrs;
            storeHook = hook;
            return;
          }
        }
        hook = hook.next;
        hookIdx++;
      }
      
      walkFiber(fiber.child, depth + 1);
      walkFiber(fiber.sibling, depth + 1);
    }
    
    walkFiber(html[fiberKey]);
    
    if (!storeState) return 'store not found';
    
    // Now try to bypass auth and navigate to home
    // We need to set isAuthenticated to true and set a mock user
    // But we can't directly mutate the store state
    
    // Instead, let's try calling the navigate function
    // and see if it takes us to home (it might redirect to login)
    const currentScreen = storeState.currentScreen;
    
    // Try to call the login function with a mock user
    const allKeys = Object.keys(storeState).filter(k => typeof storeState[k] === 'function');
    
    // Look for login/setUser/setIsAuthenticated
    const loginFn = storeState.login || storeState.setUser || storeState.setIsAuthenticated;
    
    // Try to call login with a mock user object
    if (typeof storeState.login === 'function') {
      try {
        // Create a minimal mock user
        storeState.login({
          id: 'test-user-id',
          email: 'test@test.com',
          name: 'Test User',
          role: 'buyer',
          isVerified: true,
          loyaltyPoints: 0,
          coins: 0,
        });
      } catch(e) {
        // login might expect different arguments
      }
    }
    
    // Now navigate to home
    try {
      storeState.navigate('home');
    } catch(e) {}
    
    return { 
      currentScreen, 
      isAuthenticated: storeState.isAuthenticated,
      functionKeys: allKeys,
      hasLogin: typeof storeState.login === 'function',
      hasSetIsAuth: typeof storeState.setIsAuthenticated === 'function',
    };
  });
  console.log('Full nav result:', JSON.stringify(fullNavResult));
  await page.waitForTimeout(3000);
  
  bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Body after full nav:', bodyText.substring(0, 500));
  
  R.showsHome = bodyText.includes('Semua') || bodyText.includes('Barang') || bodyText.includes('Tolong Mas');
  
  if (R.showsHome) {
    console.log('SUCCESS! We are on the home screen!');
    await page.screenshot({ path: '/tmp/s-home.png' });
    
    // T2: Toggle visible
    R.t2 = bodyText.includes('Semua') && bodyText.includes('Barang') && bodyText.includes('Tolong Mas');
    
    // T3: Click Barang
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Barang') && b.textContent?.includes('📦'))?.click());
    await page.waitForTimeout(1200);
    const t3Text = await page.evaluate(() => document.body.innerText);
    R.t3 = t3Text.includes('📦 Barang');
    R.t3_sub = t3Text.includes('Produk fisik dikirim ke rumahmu');
    await page.screenshot({ path: '/tmp/s-barang.png' });
    console.log('T3 (Barang):', R.t3);

    // T4: Click Tolong Mas
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Tolong Mas') && b.textContent?.includes('🤝'))?.click());
    await page.waitForTimeout(1200);
    const t4Text = await page.evaluate(() => document.body.innerText);
    R.t4 = t4Text.includes('🤝 Tolong Mas') && t4Text.includes('Belum Ada Layanan Tolong Mas');
    R.t4_header = t4Text.includes('🤝 Tolong Mas');
    R.t4_empty = t4Text.includes('Belum Ada Layanan Tolong Mas');
    R.t4_sub = t4Text.includes('Layanan Tolong Mas akan muncul');
    await page.screenshot({ path: '/tmp/s-tolongmas.png' });
    console.log('T4 (Tolong Mas):', R.t4);

    // T5: Click Semua
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent?.includes('Semua') && b.textContent?.includes('🔥'))?.click());
    await page.waitForTimeout(1200);
    const t5Text = await page.evaluate(() => document.body.innerText);
    R.t5 = t5Text.includes('Rekomendasi Untukmu');
    await page.screenshot({ path: '/tmp/s-semua.png' });
    console.log('T5 (Semua):', R.t5);

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
      const t6Text = await page.evaluate(() => document.body.innerText);
      R.t6 = t6Text.includes('Semua') && (t6Text.includes('📦') || t6Text.includes('🤝'));
      R.t6_filter = t6Text.includes('Filter');
      await page.screenshot({ path: '/tmp/s-search.png' });
    } else {
      R.t6 = false; R.t6_err = 'no search input';
    }
    console.log('T6 (Search):', R.t6);
  }

  R.errors = consoleErrors.slice(0, 10);
  R.pageErrors = pageErrors.slice(0, 5);
  await browser.close();
  console.log('\nFINAL:');
  console.log(JSON.stringify(R, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
