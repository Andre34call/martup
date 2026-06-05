import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  
  // Intercept the zustand store before page loads
  // We'll patch the zustand create function to capture the store reference
  await context.addInitScript(() => {
    // Store the original zustand module
    // We'll patch it when it loads
    window.__storeCaptureAttempts = [];
    
    // Override Object.defineProperty to intercept store creation
    // This is a hack but should work
    
    // Monitor for any object with 'currentScreen' property being set
    let _storeRef = null;
    
    // Use a Proxy on the window to catch any store-like objects
    // Actually, let's try a simpler approach:
    // After the page loads, we'll find the store by searching all module exports
    
    // Most reliable: patch the zustand create function
    // But we don't know when zustand will load
    
    // Alternative: Use a MutationObserver to watch for the onboarding screen
    // and auto-click through it
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
  await page.waitForTimeout(6000); // Wait for full hydration

  // Step 1: Skip onboarding
  console.log('Step 1: Skip onboarding');
  const skipResult = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const skipBtn = btns.find(b => b.textContent?.trim() === 'Skip');
    if (skipBtn) { skipBtn.click(); return 'skipped'; }
    return 'no skip button found. Buttons: ' + btns.map(b => b.textContent?.trim()).join(', ');
  });
  console.log('Skip result:', skipResult);
  await page.waitForTimeout(2000);

  // Step 2: We should be on login screen now
  // Let's try to register a new account through the UI
  console.log('Step 2: Navigate to register');
  const registerBtn = page.locator('button:has-text("Daftar"), a:has-text("Daftar")').first();
  const hasRegister = await registerBtn.count();
  console.log('Register button found:', hasRegister > 0);
  
  if (hasRegister > 0) {
    await registerBtn.click();
    await page.waitForTimeout(2000);
    
    // Fill in the registration form
    const nameInput = page.locator('input[placeholder*="Nama"], input[placeholder*="name"]').first();
    const emailInput = page.locator('input[type="email"], input[placeholder*="Email"], input[placeholder*="email"]').first();
    const phoneInput = page.locator('input[type="tel"], input[placeholder*="Phone"], input[placeholder*="HP"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    console.log('Form fields - name:', await nameInput.count(), 'email:', await emailInput.count(), 
                'phone:', await phoneInput.count(), 'password:', await passwordInput.count());
    
    if (await nameInput.count() > 0) await nameInput.fill('Test User');
    if (await emailInput.count() > 0) await emailInput.fill('testuser123@martup.com');
    if (await phoneInput.count() > 0) await phoneInput.fill('081234567890');
    if (await passwordInput.count() > 0) await passwordInput.fill('Test1234!');
    
    // Check for a confirm password field
    const confirmInput = page.locator('input[type="password"]').nth(1);
    if (await confirmInput.count() > 0) await confirmInput.fill('Test1234!');
    
    await page.screenshot({ path: '/tmp/s-register-form.png' });
    
    // Click register button
    const submitBtn = page.locator('button[type="submit"], button:has-text("Daftar"), button:has-text("Register")').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await page.waitForTimeout(5000);
      
      const afterReg = await page.evaluate(() => document.body.innerText.substring(0, 1000));
      console.log('After register:', afterReg.substring(0, 300));
      
      await page.screenshot({ path: '/tmp/s-after-register.png' });
    }
  }

  // Check if we're on the home screen or need OTP verification
  let bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log('Current screen:', bodyText.substring(0, 300));
  
  // If we're on OTP screen, we might need to bypass it
  if (bodyText.includes('OTP') || bodyText.includes('Verifikasi')) {
    console.log('On OTP screen, trying to bypass...');
    
    // Check if there's a way to skip OTP in dev mode
    const otpInput = page.locator('input[type="text"], input[type="number"], input[placeholder*="OTP"], input[placeholder*="kode"]').first();
    if (await otpInput.count() > 0) {
      // Try entering a common test OTP
      await otpInput.fill('123456');
      const verifyBtn = page.locator('button:has-text("Verifikasi"), button:has-text("Verify"), button[type="submit"]').first();
      if (await verifyBtn.count() > 0) {
        await verifyBtn.click();
        await page.waitForTimeout(3000);
      }
    }
  }

  bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  R.showsHome = bodyText.includes('Semua') || bodyText.includes('Barang') || bodyText.includes('Tolong Mas');
  
  // If still not on home, try to find and manipulate the store one more time
  if (!R.showsHome) {
    console.log('Still not on home. Trying store manipulation...');
    
    // The most reliable way: use React's internal fiber tree with a fresh walk
    const storeNav = await page.evaluate(() => {
      // Find the root container element
      const root = document.querySelector('[data-reactroot]') || 
                   document.querySelector('#__next') ||
                   document.querySelector('[class*="app-container"]') ||
                   document.body.firstElementChild;
      
      if (!root) return 'no root element';
      
      // Get the fiber key
      const fiberKey = Object.keys(root).find(k => 
        k.startsWith('__reactInternalInstance') || k.startsWith('__reactFiber')
      );
      if (!fiberKey) return 'no fiber on root';
      
      let found = null;
      
      // More thorough search - also check child elements
      function searchElement(el) {
        if (found) return;
        const fk = Object.keys(el).find(k => k.startsWith('__reactFiber'));
        if (!fk) return;
        
        let fiber = el[fk];
        let depth = 0;
        while (fiber && depth < 50 && !found) {
          let hook = fiber.memoizedState;
          let hIdx = 0;
          while (hook && hIdx < 100 && !found) {
            try {
              if (hook.queue?.lastRenderedState && typeof hook.queue.lastRenderedState === 'object') {
                const s = hook.queue.lastRenderedState;
                if ('currentScreen' in s && 'navigate' in s) {
                  // Found! Navigate and set auth
                  if (typeof s.login === 'function') {
                    s.login({
                      id: 'test',
                      email: 'test@test.com', 
                      name: 'Test',
                      role: 'buyer',
                      isVerified: true,
                      loyaltyPoints: 0,
                      coins: 0,
                    });
                  }
                  s.navigate('home');
                  found = { navigated: true, screen: s.currentScreen };
                }
              }
            } catch(e) {}
            hook = hook.next;
            hIdx++;
          }
          fiber = fiber.child;
          depth++;
        }
      }
      
      // Search from multiple starting points
      const allElements = document.querySelectorAll('div, section, main');
      for (const el of allElements) {
        searchElement(el);
        if (found) break;
      }
      
      return found || 'not found';
    });
    console.log('Store nav result:', JSON.stringify(storeNav));
    await page.waitForTimeout(3000);
    
    bodyText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
    R.showsHome = bodyText.includes('Semua') || bodyText.includes('Barang') || bodyText.includes('Tolong Mas');
    console.log('After store nav - shows home:', R.showsHome);
  }

  // Final screenshots regardless
  await page.screenshot({ path: '/tmp/s-final-state.png' });

  R.errors = consoleErrors.slice(0, 10);
  R.pageErrors = pageErrors.slice(0, 5);
  await browser.close();
  console.log('\nFINAL:');
  console.log(JSON.stringify(R, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
