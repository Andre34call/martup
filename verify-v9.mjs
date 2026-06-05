import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  
  // Intercept the zustand store creation to capture a reference
  await context.addInitScript(() => {
    // Override the Zustand create function to capture the store
    const origCreate = window.__ZUSTAND_ORIG_CREATE__;
    
    // We'll capture the store when it's created
    window.__capturedStores = [];
    
    // Intercept module loading to find the zustand store
    // The store will be created during module initialization
    // We'll use a Proxy to intercept the zustand create call
    
    // Alternative: Monitor for objects with 'currentScreen' and 'navigate' properties
    // by intercepting Object.defineProperty and property assignments
    
    // Simpler approach: after page load, search all JS objects for the store
    window.__findStore = function() {
      // Walk the module cache
      const modules = [];
      
      // Check Turbopack module cache
      for (const key of Object.keys(window)) {
        try {
          const val = window[key];
          if (val && typeof val === 'object' && 'currentScreen' in val && 'navigate' in val) {
            return { source: 'window', key, store: val };
          }
          if (val && typeof val === 'function' && 'getState' in val) {
            const state = val.getState();
            if (state && 'currentScreen' in state) {
              return { source: 'window_func', key, store: val, state };
            }
          }
        } catch(e) {}
      }
      
      return null;
    };
  });
  
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.message));

  const R = {};

  // Load the page
  console.log('Loading page...');
  await page.goto('http://localhost:3000', { timeout: 30000 });
  await page.waitForTimeout(5000);

  // Try to find the store via our init script
  const storeSearch = await page.evaluate(() => {
    return window.__findStore ? window.__findStore() : 'init script not run';
  });
  console.log('Store search:', JSON.stringify(storeSearch));

  // Alternative: directly search the Turbopack module cache
  const moduleSearch = await page.evaluate(() => {
    // Turbopack stores modules in a specific data structure
    // Let's search for any object that has both 'currentScreen' and 'navigate'
    
    // Method 1: Search all global variables
    const results = [];
    for (const key of Object.getOwnPropertyNames(window)) {
      try {
        const val = window[key];
        if (val && typeof val === 'object') {
          if ('currentScreen' in val && 'navigate' in val) {
            results.push({ type: 'object', key, currentScreen: val.currentScreen });
          }
        }
        if (val && typeof val === 'function') {
          if ('getState' in val) {
            try {
              const state = val.getState();
              if (state && 'currentScreen' in state) {
                results.push({ type: 'function', key, currentScreen: state.currentScreen });
              }
            } catch(e) {}
          }
        }
      } catch(e) {}
    }
    
    return results.length > 0 ? results : 'not found in globals';
  });
  console.log('Module search:', JSON.stringify(moduleSearch));

  // Method: Use React DevTools approach - walk the fiber tree and find hooks
  const reactStoreSearch = await page.evaluate(() => {
    const html = document.documentElement;
    const fiberKey = Object.keys(html).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return 'no fiber';
    
    let result = null;
    
    function walkFiber(fiber, depth = 0) {
      if (!fiber || depth > 200 || result) return;
      
      // Check hooks chain
      let hook = fiber.memoizedState;
      let hookIdx = 0;
      while (hook && hookIdx < 100 && !result) {
        // Zustand uses useSyncExternalStoreWithSelector in newer versions
        // or useStore in older versions
        // The hook's queue.lastRenderedState should contain the store state
        
        // Check if this hook state looks like a zustand store subscription
        if (hook.memoizedState !== undefined) {
          const ms = hook.memoizedState;
          
          // Zustand v4+ uses useSyncExternalStore
          // The memoizedState is the selected state
          if (ms && typeof ms === 'object') {
            if ('currentScreen' in ms && 'navigate' in ms) {
              result = { 
                found: true, 
                currentScreen: ms.currentScreen,
                isAuthenticated: ms.isAuthenticated,
                depth,
                hookIdx
              };
              return;
            }
          }
          
          // Also check the queue
          if (hook.queue && hook.queue.lastRenderedState) {
            const lrs = hook.queue.lastRenderedState;
            if (lrs && typeof lrs === 'object' && 'currentScreen' in lrs) {
              result = {
                found: true,
                currentScreen: lrs.currentScreen,
                isAuthenticated: lrs.isAuthenticated,
                depth,
                hookIdx,
                source: 'queue'
              };
              return;
            }
          }
        }
        
        hook = hook.next;
        hookIdx++;
      }
      
      // Walk children
      walkFiber(fiber.child, depth + 1);
      walkFiber(fiber.sibling, depth + 1);
    }
    
    walkFiber(html[fiberKey]);
    return result || 'not found in fiber tree';
  });
  console.log('React store search:', JSON.stringify(reactStoreSearch));

  // If we found the store through React, try to navigate
  if (reactStoreSearch && typeof reactStoreSearch === 'object' && reactStoreSearch.found) {
    console.log('Found store in React tree! Trying to navigate...');
    
    const navResult = await page.evaluate((hookInfo) => {
      const html = document.documentElement;
      const fiberKey = Object.keys(html).find(k => k.startsWith('__reactFiber'));
      if (!fiberKey) return 'no fiber';
      
      let foundHook = null;
      
      function walkFiber(fiber, depth = 0) {
        if (!fiber || depth > 200 || foundHook) return;
        
        let hook = fiber.memoizedState;
        let hookIdx = 0;
        while (hook && hookIdx < 100 && !foundHook) {
          if (hook.queue && hook.queue.lastRenderedState) {
            const lrs = hook.queue.lastRenderedState;
            if (lrs && typeof lrs === 'object' && 'currentScreen' in lrs && 'navigate' in lrs) {
              foundHook = { hook, state: lrs };
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
      
      if (foundHook) {
        // We found the store state, but we need to update it
        // In Zustand, we can't just mutate the state - we need to use the store's API
        // However, the navigate function is in the state, so we can call it
        
        if (typeof foundHook.state.navigate === 'function') {
          foundHook.state.navigate('home');
          return 'navigated to home';
        }
        
        // Alternative: directly modify the state (this won't trigger re-render)
        // But we can try dispatching through the queue
        const dispatch = foundHook.hook.queue?.dispatch;
        if (dispatch) {
          // This is a React dispatch, not zustand
          // We need the zustand setState
        }
        
        return 'navigate function found but could not call';
      }
      
      return 'hook not found on second pass';
    }, reactStoreSearch);
    
    console.log('Nav result:', navResult);
    await page.waitForTimeout(2000);
  }

  // Let's try yet another approach - use the zustand store directly
  // by evaluating code that imports the store module
  const directImport = await page.evaluate(() => {
    // In Next.js with Turbopack, modules are loaded dynamically
    // The store should be available in the module cache
    // Try to access it through the Turbopack runtime
    
    // Check for __turbopack_load__
    if (typeof __turbopack_load__ === 'function') {
      try {
        // Try to load the store module
        const storeModule = __turbopack_load__('./src/lib/store/index.ts');
        if (storeModule && storeModule.useAppStore) {
          const store = storeModule.useAppStore;
          store.getState().navigate('home');
          return 'loaded via turbopack';
        }
      } catch(e) {
        return 'turbopack error: ' + e.message;
      }
    }
    
    // Try __turbopack_require__
    if (typeof __turbopack_require__ === 'function') {
      try {
        const storeModule = __turbopack_require__('./src/lib/store/index.ts');
        if (storeModule && storeModule.useAppStore) {
          storeModule.useAppStore.getState().navigate('home');
          return 'loaded via turbopack require';
        }
      } catch(e) {
        return 'turbopack require error: ' + e.message;
      }
    }
    
    return 'no turbopack API found';
  });
  console.log('Direct import:', directImport);

  // Check final state
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  R.showsHome = bodyText.includes('Semua') && bodyText.includes('Barang');
  console.log('Shows home:', R.showsHome);
  console.log('Body (first 500):', bodyText.substring(0, 500));
  
  await page.screenshot({ path: '/tmp/s-final.png' });

  R.errors = consoleErrors.slice(0, 10);
  R.pageErrors = pageErrors.slice(0, 5);
  await browser.close();
  console.log(JSON.stringify(R, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
