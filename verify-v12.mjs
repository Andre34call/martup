import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  
  // CRITICAL: Intercept zustand store creation BEFORE the page loads
  // This will capture the store reference when it's created
  await context.addInitScript(() => {
    // Monkey-patch Proxy/Reflect to intercept zustand store creation
    // Zustand's create function returns a hook with getState/setState/subscribe
    // We'll look for any object with these methods
    
    // Approach: Override the module system to capture the store
    // When zustand's create is called, it returns a useStore hook
    // That hook has .getState(), .setState(), .subscribe()
    
    // We'll use a different strategy: monitor for function creation
    // and check if any function has getState method
    
    // Store captured store reference
    window.__appStoreRef = null;
    
    // Override Function.prototype to intercept zustand store creation
    // Actually, let's just set up a polling mechanism
    const originalDefineProperty = Object.defineProperty;
    
    // Monitor for zustand store creation by checking for functions
    // that have getState method
    const checkInterval = setInterval(() => {
      // Search all objects in the window scope
      for (const key of Object.getOwnPropertyNames(window)) {
        try {
          const val = window[key];
          if (typeof val === 'function' && typeof val.getState === 'function') {
            const state = val.getState();
            if (state && 'currentScreen' in state && 'navigate' in state) {
              window.__appStoreRef = val;
              clearInterval(checkInterval);
              console.log('CAPTURED STORE:', state.currentScreen);
              break;
            }
          }
        } catch(e) {}
      }
    }, 100);
    
    // Also, try to find the store by patching zustand's create
    // We can do this by intercepting the import of zustand
    // through the module system
    
    // For Turbopack: intercept the module loading
    const origLoad = window.__turbopack_load__;
    if (origLoad) {
      window.__turbopack_load__ = function(...args) {
        const result = origLoad.apply(this, args);
        // Check if the result is a zustand store
        if (result && typeof result === 'object') {
          for (const key of Object.keys(result)) {
            const val = result[key];
            if (typeof val === 'function' && typeof val.getState === 'function') {
              const state = val.getState();
              if (state && 'currentScreen' in state) {
                window.__appStoreRef = val;
              }
            }
          }
        }
        return result;
      };
    }
  });
  
  const page = await context.newPage();
  const consoleMsgs = [];
  page.on('console', msg => { 
    consoleMsgs.push({ type: msg.type(), text: msg.text() });
    if (msg.text().includes('CAPTURED STORE')) {
      console.log('CAPTURED:', msg.text());
    }
  });

  const R = {};

  // Load the page
  console.log('Loading page...');
  await page.goto('http://localhost:3000', { timeout: 30000 });
  await page.waitForTimeout(6000);

  // Check if we captured the store
  const storeCaptured = await page.evaluate(() => {
    return window.__appStoreRef ? { captured: true, screen: window.__appStoreRef.getState().currentScreen } : { captured: false };
  });
  console.log('Store captured:', JSON.stringify(storeCaptured));

  if (storeCaptured.captured) {
    // Navigate to home by setting auth state and navigating
    console.log('Setting auth state and navigating to home...');
    await page.evaluate(() => {
      const store = window.__appStoreRef;
      // Set a mock user and authenticate
      store.setState({
        isAuthenticated: true,
        currentUser: {
          id: 'test-user-id',
          email: 'test@test.com',
          name: 'Test User',
          role: 'buyer',
          isVerified: true,
          loyaltyPoints: 0,
          coins: 0,
        },
        currentScreen: 'home',
      });
    });
    await page.waitForTimeout(3000);
    
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    R.showsHome = bodyText.includes('Semua') || bodyText.includes('Barang') || bodyText.includes('Tolong Mas');
    console.log('Shows home after store setState:', R.showsHome);
    console.log('Body (first 500):', bodyText.substring(0, 500));
    
    await page.screenshot({ path: '/tmp/s-after-setstate.png' });
  } else {
    console.log('Store not captured. Trying alternative approach...');
    
    // Try to find the store by polling after page load
    const altStore = await page.evaluate(() => {
      // Search all window properties
      for (const key of Object.getOwnPropertyNames(window)) {
        try {
          const val = window[key];
          if (typeof val === 'function' && typeof val.getState === 'function') {
            const state = val.getState();
            if (state && 'currentScreen' in state && 'navigate' in state) {
              window.__appStoreRef = val;
              return { found: true, key, screen: state.currentScreen };
            }
          }
        } catch(e) {}
      }
      
      // Also search the Turbopack module cache
      // The modules are stored in window.__next_f or similar
      
      return { found: false };
    });
    console.log('Alt store search:', JSON.stringify(altStore));
    
    if (altStore.found) {
      // Set state and navigate
      await page.evaluate(() => {
        const store = window.__appStoreRef;
        store.setState({
          isAuthenticated: true,
          currentUser: {
            id: 'test-user-id',
            email: 'test@test.com',
            name: 'Test User',
            role: 'buyer',
            isVerified: true,
            loyaltyPoints: 0,
            coins: 0,
          },
          currentScreen: 'home',
        });
      });
      await page.waitForTimeout(3000);
    }
    
    // If still not found, try a completely different approach
    // Use React DevTools to find the store
    if (!altStore.found) {
      console.log('Trying React DevTools approach...');
      
      // Find all React elements and check their hooks
      const devtoolsResult = await page.evaluate(() => {
        // Walk the DOM and find all elements with React fiber
        const allDivs = document.querySelectorAll('*');
        for (const el of allDivs) {
          const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
          if (!fiberKey) continue;
          
          let fiber = el[fiberKey];
          // Walk up and down the fiber tree
          let attempts = 0;
          while (fiber && attempts < 500) {
            // Check each hook in the memoizedState chain
            let hook = fiber.memoizedState;
            while (hook) {
              try {
                // For useSyncExternalStore (zustand v4+), the structure is:
                // hook.memoizedState = selectedState
                // hook.queue.lastRenderedState = selectedState
                // The store subscribe function is in the hook's dependencies
                
                // Check if this is a zustand store subscription
                const inst = hook.memoizedState;
                if (inst && typeof inst === 'object' && 'currentScreen' in inst && 'navigate' in inst) {
                  // Found the store state!
                  // Now we need to find the store object itself
                  // The store is captured in the closure of the subscribe function
                  
                  // Try to find the subscribe function
                  // In useSyncExternalStore, the subscribe function is stored in the hook
                  // Let's look at the hook's source
                  
                  // For now, let's just try to call navigate
                  if (typeof inst.navigate === 'function') {
                    inst.navigate('home');
                    return { found: true, method: 'navigate_call', screen: inst.currentScreen };
                  }
                }
              } catch(e) {}
              hook = hook.next;
            }
            
            fiber = fiber.child || fiber.sibling || fiber.return?.sibling;
            attempts++;
          }
        }
        return { found: false };
      });
      console.log('DevTools result:', JSON.stringify(devtoolsResult));
      await page.waitForTimeout(3000);
    }
  }

  // Final check
  const finalBody = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  R.t1 = true; // Page loads
  R.showsHome = finalBody.includes('Semua') || finalBody.includes('Barang') || finalBody.includes('Tolong Mas');
  console.log('Final body (first 300):', finalBody.substring(0, 300));
  console.log('Shows home:', R.showsHome);
  
  await page.screenshot({ path: '/tmp/s-final.png' });
  
  R.consoleErrors = consoleMsgs.filter(m => m.type === 'error').map(m => m.text).slice(0, 10);
  
  await browser.close();
  console.log(JSON.stringify(R, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
