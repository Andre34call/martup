import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = '/home/z/my-project/test-screenshots';
const BASE_URL = 'http://localhost:3000';

// Ensure screenshot dir exists
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function takeScreenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot saved: ${filepath}`);
  return filepath;
}

async function getConsoleErrors(page) {
  return page.evaluate(() => {
    // Collect any errors from window.__consoleErrors if we injected a listener
    return window.__consoleErrors || [];
  });
}

async function main() {
  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 390, height: 844 }, // iPhone 14 Pro viewport
  });

  const page = await browser.newPage();

  // Collect console messages
  const consoleMessages = [];
  const consoleErrors = [];
  const consoleWarnings = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
    if (type === 'error') consoleErrors.push(text);
    if (type === 'warning') consoleWarnings.push(text);
  });

  // Collect page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  // Collect network errors
  const networkErrors = [];
  page.on('requestfailed', request => {
    networkErrors.push({
      url: request.url(),
      error: request.failure()?.errorText,
    });
  });

  const results = {
    steps: [],
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    networkErrors: [],
  };

  // ==================== STEP 1: Navigate to homepage ====================
  console.log('\n📍 STEP 1: Navigate to http://localhost:3000/');
  await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  const url1 = page.url();
  console.log(`  Current URL: ${url1}`);
  await takeScreenshot(page, '01-homepage-loaded');
  results.steps.push({
    step: 'Navigate to homepage',
    url: url1,
    status: 'loaded',
  });

  // ==================== STEP 2: Wait for splash screen (2 seconds) ====================
  console.log('\n📍 STEP 2: Wait for splash screen animation');
  await page.waitForTimeout(2500); // Wait a bit more than the 2s splash timer
  const url2 = page.url();
  console.log(`  Current URL: ${url2}`);
  await takeScreenshot(page, '02-after-splash');

  // Check what screen we're on now
  const screenAfterSplash = await page.evaluate(() => {
    // Check for onboarding indicators
    const skipBtn = document.querySelector('button');
    const allText = document.body.innerText;
    if (allText.includes('Skip')) return 'onboarding';
    if (allText.includes('Masuk') || allText.includes('Login')) return 'login';
    if (allText.includes('Shop Smart')) return 'splash';
    return 'unknown: ' + allText.substring(0, 200);
  });
  console.log(`  Detected screen: ${screenAfterSplash}`);
  results.steps.push({
    step: 'After splash screen timeout',
    url: url2,
    detectedScreen: screenAfterSplash,
  });

  // ==================== STEP 3: Click through onboarding ====================
  console.log('\n📍 STEP 3: Navigate through onboarding');
  if (screenAfterSplash === 'onboarding') {
    // Click "Skip" button to skip onboarding
    const skipClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.trim() === 'Skip') {
          btn.click();
          return true;
        }
      }
      return false;
    });
    console.log(`  Skip button clicked: ${skipClicked}`);
    await page.waitForTimeout(1000);
    await takeScreenshot(page, '03-after-onboarding-skip');
  } else {
    console.log('  Not on onboarding screen, skipping...');
  }

  const url3 = page.url();
  const screenAfterOnboarding = await page.evaluate(() => {
    const allText = document.body.innerText;
    if (allText.includes('Selamat Datang') || allText.includes('Masuk ke akunmu')) return 'login';
    if (allText.includes('Buat Akun') || allText.includes('Daftar')) return 'register';
    return 'unknown: ' + allText.substring(0, 200);
  });
  console.log(`  Current URL: ${url3}, Screen: ${screenAfterOnboarding}`);
  results.steps.push({
    step: 'After onboarding skip',
    url: url3,
    detectedScreen: screenAfterOnboarding,
  });

  // ==================== STEP 4: Try login ====================
  console.log('\n📍 STEP 4: Try login with test@test.com / test123');

  // If not on login screen, try to navigate to it
  if (screenAfterOnboarding !== 'login') {
    console.log('  Not on login screen, looking for login navigation...');
    await page.evaluate(() => {
      // Try clicking login link
      const links = document.querySelectorAll('button');
      for (const link of links) {
        if (link.textContent?.includes('Masuk') || link.textContent?.includes('Login')) {
          link.click();
          return;
        }
      }
    });
    await page.waitForTimeout(1000);
  }

  // Fill in the login form
  const emailInput = await page.$('input[placeholder*="email"], input[placeholder*="contoh"]');
  const passwordInput = await page.$('input[type="password"], input[placeholder*="assword"]');

  if (emailInput && passwordInput) {
    console.log('  Found email and password inputs');
    await emailInput.click({ clickCount: 3 });
    await emailInput.type('test@test.com');
    await passwordInput.click({ clickCount: 3 });
    await passwordInput.type('test123');
    await takeScreenshot(page, '04-login-form-filled');

    // Submit the form
    const submitBtn = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.includes('Masuk') && btn.type === 'submit') {
          btn.click();
          return 'clicked';
        }
      }
      // Also try clicking any submit button
      const submitButtons = document.querySelectorAll('button[type="submit"]');
      if (submitButtons.length > 0) {
        submitButtons[0].click();
        return 'clicked-submit';
      }
      return 'not-found';
    });
    console.log(`  Submit button: ${submitBtn}`);
    await page.waitForTimeout(4000); // Wait for response
    await takeScreenshot(page, '05-after-login-attempt');

    const url5 = page.url();
    const loginResult = await page.evaluate(() => {
      const allText = document.body.innerText;
      // Check for error messages in toasts or inline
      const toasts = document.querySelectorAll('[class*="toast"], [class*="Toast"]');
      const toastTexts = Array.from(toasts).map(t => t.textContent);
      return {
        hasError: allText.includes('salah') || allText.includes('gagal') || allText.includes('error'),
        toastMessages: toastTexts,
        bodySnippet: allText.substring(0, 500),
      };
    });
    console.log(`  Current URL: ${url5}`);
    console.log(`  Login result: ${JSON.stringify(loginResult, null, 2)}`);
    results.steps.push({
      step: 'Login attempt with test@test.com / test123',
      url: url5,
      loginResult,
    });
  } else {
    console.log('  Could not find login form inputs');
    await takeScreenshot(page, '04-no-login-form');
    results.steps.push({
      step: 'Login attempt',
      error: 'Could not find login form inputs',
      url: page.url(),
    });
  }

  // ==================== STEP 5: Try register flow ====================
  console.log('\n📍 STEP 5: Try register flow');

  // Navigate to register screen
  const registerNav = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.textContent?.includes('Daftar') && !btn.type?.includes('submit')) {
        btn.click();
        return 'clicked';
      }
    }
    // Try links too
    const links = document.querySelectorAll('a');
    for (const link of links) {
      if (link.textContent?.includes('Daftar')) {
        link.click();
        return 'clicked-link';
      }
    }
    return 'not-found';
  });
  console.log(`  Navigate to register: ${registerNav}`);
  await page.waitForTimeout(1500);
  await takeScreenshot(page, '06-register-screen');

  const registerScreenDetected = await page.evaluate(() => {
    const allText = document.body.innerText;
    if (allText.includes('Buat Akun') || allText.includes('Nama Lengkap')) return 'register';
    return 'unknown: ' + allText.substring(0, 200);
  });
  console.log(`  Screen detected: ${registerScreenDetected}`);

  if (registerScreenDetected === 'register') {
    // Fill register form
    const nameInput = await page.$('input[placeholder*="nama"], input[placeholder*="Nama"]');
    const emailRegInput = await page.$('input[placeholder*="contoh@email"]');
    const phoneInput = await page.$('input[placeholder*="0812"], input[placeholder*="HP"]');
    const passwordInputs = await page.$$('input[type="password"]');

    if (nameInput && emailRegInput && phoneInput && passwordInputs.length >= 2) {
      console.log('  Found all register form inputs');
      await nameInput.click({ clickCount: 3 });
      await nameInput.type('Test User');
      await emailRegInput.click({ clickCount: 3 });
      await emailRegInput.type('testuser123@test.com');
      await phoneInput.click({ clickCount: 3 });
      await phoneInput.type('081234567890');
      await passwordInputs[0].click({ clickCount: 3 });
      await passwordInputs[0].type('Test@1234');
      await passwordInputs[1].click({ clickCount: 3 });
      await passwordInputs[1].type('Test@1234');

      // Check the terms checkbox
      const termsChecked = await page.evaluate(() => {
        const checkbox = document.querySelector('button[role="checkbox"], input[type="checkbox"]');
        if (checkbox) {
          checkbox.click();
          return true;
        }
        // Try radix checkbox
        const radixCheckbox = document.querySelector('[data-state="unchecked"]');
        if (radixCheckbox) {
          radixCheckbox.click();
          return true;
        }
        return false;
      });
      console.log(`  Terms checkbox clicked: ${termsChecked}`);
      await page.waitForTimeout(500);
      await takeScreenshot(page, '07-register-form-filled');

      // Submit
      const regSubmit = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button[type="submit"]');
        for (const btn of buttons) {
          if (btn.textContent?.includes('Daftar')) {
            btn.click();
            return 'clicked';
          }
        }
        return 'not-found';
      });
      console.log(`  Register submit: ${regSubmit}`);
      await page.waitForTimeout(5000); // Wait for response
      await takeScreenshot(page, '08-after-register-attempt');

      const url8 = page.url();
      const registerResult = await page.evaluate(() => {
        const allText = document.body.innerText;
        const toasts = document.querySelectorAll('[class*="toast"], [class*="Toast"]');
        const toastTexts = Array.from(toasts).map(t => t.textContent);
        return {
          hasError: allText.includes('gagal') || allText.includes('error') || allText.includes('sudah terdaftar'),
          hasSuccess: allText.includes('berhasil') || allText.includes('aktif'),
          toastMessages: toastTexts,
          bodySnippet: allText.substring(0, 500),
        };
      });
      console.log(`  Current URL: ${url8}`);
      console.log(`  Register result: ${JSON.stringify(registerResult, null, 2)}`);
      results.steps.push({
        step: 'Register attempt',
        url: url8,
        registerResult,
      });
    } else {
      console.log('  Could not find all register form inputs');
      results.steps.push({
        step: 'Register attempt',
        error: 'Could not find all register form inputs',
        url: page.url(),
      });
    }
  } else {
    console.log('  Not on register screen');
    results.steps.push({
      step: 'Register attempt',
      error: 'Could not navigate to register screen',
      url: page.url(),
    });
  }

  // ==================== STEP 6: Test API endpoints directly ====================
  console.log('\n📍 STEP 6: Test API endpoints directly');
  
  // Test login API
  const loginApiResponse = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'test123' }),
      });
      const data = await res.json();
      return { status: res.status, data };
    } catch (err) {
      return { error: err.message };
    }
  });
  console.log(`  Login API response: ${JSON.stringify(loginApiResponse, null, 2)}`);
  results.steps.push({
    step: 'Direct login API call',
    apiResponse: loginApiResponse,
  });

  // Test register API
  const registerApiResponse = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test User Browser',
          email: 'testbrowser_' + Date.now() + '@test.com',
          phone: '089988776655',
          password: 'Test@1234',
        }),
      });
      const data = await res.json();
      return { status: res.status, data };
    } catch (err) {
      return { error: err.message };
    }
  });
  console.log(`  Register API response: ${JSON.stringify(registerApiResponse, null, 2)}`);
  results.steps.push({
    step: 'Direct register API call',
    apiResponse: registerApiResponse,
  });

  // Test health endpoint
  const healthResponse = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      return { status: res.status, data };
    } catch (err) {
      return { error: err.message };
    }
  });
  console.log(`  Health API response: ${JSON.stringify(healthResponse, null, 2)}`);
  results.steps.push({
    step: 'Health check API',
    apiResponse: healthResponse,
  });

  // ==================== Collect all console/network errors ====================
  results.consoleErrors = consoleErrors;
  results.consoleWarnings = consoleWarnings;
  results.pageErrors = pageErrors;
  results.networkErrors = networkErrors;

  console.log('\n📊 SUMMARY');
  console.log('================');
  console.log(`Console errors (${consoleErrors.length}):`);
  consoleErrors.forEach(e => console.log(`  ❌ ${e}`));
  console.log(`Page errors (${pageErrors.length}):`);
  pageErrors.forEach(e => console.log(`  ❌ ${e}`));
  console.log(`Network errors (${networkErrors.length}):`);
  networkErrors.forEach(e => console.log(`  ❌ ${e.url} - ${e.error}`));
  console.log(`Console warnings (${consoleWarnings.length}):`);
  consoleWarnings.slice(0, 10).forEach(w => console.log(`  ⚠️  ${w}`));

  // Write results to file
  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'test-results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log(`\n📝 Results saved to ${path.join(SCREENSHOT_DIR, 'test-results.json')}`);

  await browser.close();
  console.log('\n✅ Browser closed. Test complete!');
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
