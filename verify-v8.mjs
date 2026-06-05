import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.message));

  const R = {};

  // Load the page
  console.log('Loading page...');
  await page.goto('http://localhost:3000', { timeout: 30000 });
  await page.waitForTimeout(4000);

  // Skip onboarding
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const skipBtn = btns.find(b => b.textContent?.trim() === 'Skip');
    if (skipBtn) skipBtn.click();
  });
  await page.waitForTimeout(2000);
  console.log('Skipped onboarding');

  // Now we're on login screen. We need to bypass auth.
  // The app uses Zustand store which starts at 'splash' and requires auth for 'home'.
  // Let's try to access the store through the React fiber tree.
  
  // First, find the React root element
  const rootInfo = await page.evaluate(() => {
    // Check all elements for React fiber
    const allElements = document.querySelectorAll('*');
    let fiberKey = null;
    let foundEl = null;
    for (const el of allElements) {
      const keys = Object.keys(el);
      const fk = keys.find(k => k.startsWith('__reactFiber'));
      if (fk) {
        fiberKey = fk;
        foundEl = el.tagName;
        break;
      }
    }
    return { fiberKey, foundEl, nextEl: !!document.getElementById('__next') };
  });
  console.log('Root info:', JSON.stringify(rootInfo));

  // Access the zustand store through the fiber tree
  const storeResult = await page.evaluate(() => {
    // Find any element with React fiber
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const keys = Object.keys(el);
      const fiberKey = keys.find(k => k.startsWith('__reactFiber'));
      if (fiberKey) {
        // Walk up the fiber tree to find a component with the store
        let fiber = el[fiberKey];
        let depth = 0;
        while (fiber && depth < 50) {
          // Check memoizedState for zustand store references
          const state = fiber.memoizedState;
          if (state) {
            // Walk the linked list of hooks
            let hookState = state;
            let hookIdx = 0;
            while (hookState && hookIdx < 30) {
              const queue = hookState.queue;
              if (queue && queue.lastRenderedState) {
                const renderedState = queue.lastRenderedState;
                // Check if this is our app store
                if (renderedState && typeof renderedState === 'object') {
                  if ('currentScreen' in renderedState && 'navigate' in renderedState) {
                    // Found the store! Navigate to home
                    // We need to call the dispatch function
                    const dispatch = queue.dispatch;
                    if (dispatch) {
                      // Zustand stores use setState internally
                      // But the dispatch might be a React setState
                      // Let's try calling navigate directly
                      if (typeof renderedState.navigate === 'function') {
                        // Store the navigate function for later use
                        window.__navigate = renderedState.navigate;
                        window.__storeState = renderedState;
                        return { found: true, hasNavigate: true, currentScreen: renderedState.currentScreen };
                      }
                    }
                  }
                }
              }
              hookState = hookState.next;
              hookIdx++;
            }
          }
          
          // Also check the component's props for store access
          if (fiber.memoizedProps) {
            const props = fiber.memoizedProps;
            // Sometimes the store is passed as a prop
          }
          
          fiber = fiber.return;
          depth++;
        }
        break; // Only check first element with fiber
      }
    }
    return { found: false };
  });
  console.log('Store result:', JSON.stringify(storeResult));

  if (storeResult.found && storeResult.hasNavigate) {
    // Navigate to home
    console.log('Found store! Navigating to home...');
    await page.evaluate(() => {
      // Set isAuthenticated to true and navigate to home
      window.__navigate('home');
    });
    await page.waitForTimeout(2000);
  }

  // Alternative approach: use the zustand store's API directly
  // The store might be accessible via a global variable
  const altStoreAccess = await page.evaluate(() => {
    // Try accessing through the Next.js module system
    // In development, Turbopack stores modules in __turbopack_external_require__
    // or similar globals
    
    // Check for __turbopack_load__
    if (typeof __turbopack_load__ !== 'undefined') {
      return 'turbopack_load available';
    }
    
    // Check for __webpack_require__
    if (typeof __webpack_require__ !== 'undefined') {
      return 'webpack_require available';
    }
    
    // Check window.__NEXT_DATA__
    if (window.__NEXT_DATA__) {
      return 'NEXT_DATA: ' + JSON.stringify(Object.keys(window.__NEXT_DATA__));
    }
    
    return 'none found';
  });
  console.log('Alt store:', altStoreAccess);

  // Final attempt: try to find and use the zustand store through the page's module scope
  // by evaluating inside a React component
  
  // Actually, let me try using React's own mechanism
  // We can force a re-render by dispatching an event
  const forceHomeResult = await page.evaluate(() => {
    // Walk the fiber tree more thoroughly
    const body = document.body;
    const fiberKey = Object.keys(body).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return 'no fiber on body';
    
    let fiber = body[fiberKey];
    let found = false;
    
    // DFS through the fiber tree
    function searchFiber(node, depth = 0) {
      if (!node || depth > 100 || found) return;
      
      // Check memoizedState (hooks)
      let state = node.memoizedState;
      let hookIdx = 0;
      while (state && hookIdx < 50 && !found) {
        if (state.queue && state.queue.lastRenderedState) {
          const rs = state.queue.lastRenderedState;
          if (rs && typeof rs === 'object' && 'currentScreen' in rs) {
            // This is the store!
            window.__appStore = { state: rs, dispatch: state.queue.dispatch };
            found = true;
            
            // Try to use setState to navigate
            if (typeof rs.navigate === 'function') {
              rs.navigate('home');
            }
            return;
          }
        }
        state = state.next;
        hookIdx++;
      }
      
      // Check child and sibling
      searchFiber(node.child, depth + 1);
      searchFiber(node.sibling, depth + 1);
    }
    
    searchFiber(fiber);
    return found ? 'found and navigated' : 'not found';
  });
  console.log('Force home result:', forceHomeResult);

  await page.waitForTimeout(3000);

  // Check if we're on home screen now
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
  console.log('Body text (first 1000):', bodyText.substring(0, 1000));
  
  R.t1 = true;
  R.showsHome = bodyText.includes('Semua') && bodyText.includes('Barang');
  
  await page.screenshot({ path: '/tmp/s-attempt.png' });

  R.errors = consoleErrors.slice(0, 10);
  R.pageErrors = pageErrors.slice(0, 5);
  await browser.close();
  console.log(JSON.stringify(R, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
