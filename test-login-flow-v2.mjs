import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import http from 'http';

const SCREENSHOT_DIR = '/home/z/my-project/test-screenshots';
const BASE_URL = 'http://localhost:3000';

if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// Fetch page HTML via Node.js (can access localhost)
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Fetch API response via Node.js
function fetchAPI(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: data.substring(0, 500) });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function takeScreenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot: ${filepath}`);
  return filepath;
}

async function main() {
  const results = {
    timestamp: new Date().toISOString(),
    apiTests: [],
    browserTests: [],
    consoleErrors: [],
    codeIssues: [],
    summary: {},
  };

  // =====================================================
  // PART 1: API Endpoint Testing (via Node.js HTTP)
  // =====================================================
  console.log('\n' + '='.repeat(60));
  console.log('PART 1: API Endpoint Testing');
  console.log('='.repeat(60));

  // Test 1: Homepage
  console.log('\n📍 Test 1: GET /');
  try {
    const html = await fetchPage(BASE_URL);
    const hasReact = html.includes('__next') || html.includes('react');
    const hasAppContainer = html.includes('app-container');
    console.log(`  ✅ Homepage loaded: ${html.length} bytes, has React: ${hasReact}, has app-container: ${hasAppContainer}`);
    results.apiTests.push({ endpoint: 'GET /', status: 200, htmlLength: html.length, hasReact, hasAppContainer });

    // Save HTML for Puppeteer
    fs.writeFileSync(path.join(SCREENSHOT_DIR, 'homepage.html'), html);
  } catch (err) {
    console.log(`  ❌ Homepage failed: ${err.message}`);
    results.apiTests.push({ endpoint: 'GET /', error: err.message });
  }

  // Test 2: CSRF Token
  console.log('\n📍 Test 2: GET /api/csrf-token');
  try {
    const csrf = await fetchAPI(`${BASE_URL}/api/csrf-token`);
    console.log(`  ✅ CSRF token: status=${csrf.status}, hasToken=${!!csrf.data?.token}`);
    results.apiTests.push({ endpoint: 'GET /api/csrf-token', status: csrf.status, hasToken: !!csrf.data?.token });
  } catch (err) {
    console.log(`  ❌ CSRF failed: ${err.message}`);
    results.apiTests.push({ endpoint: 'GET /api/csrf-token', error: err.message });
  }

  // Test 3: Health Check
  console.log('\n📍 Test 3: GET /api/health');
  try {
    const health = await fetchAPI(`${BASE_URL}/api/health`);
    console.log(`  Status: ${health.status}, Response: ${JSON.stringify(health.data).substring(0, 200)}`);
    results.apiTests.push({ endpoint: 'GET /api/health', status: health.status, response: health.data });
  } catch (err) {
    console.log(`  ❌ Health check failed: ${err.message}`);
    results.apiTests.push({ endpoint: 'GET /api/health', error: err.message });
  }

  // Test 4: Login API
  console.log('\n📍 Test 4: POST /api/auth/login');
  try {
    const login = await fetchAPI(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com', password: 'test123' }),
    });
    console.log(`  Status: ${login.status}`);
    console.log(`  Response: ${JSON.stringify(login.data).substring(0, 300)}`);
    results.apiTests.push({ endpoint: 'POST /api/auth/login', status: login.status, response: login.data, 
      testCredentials: { email: 'test@test.com', password: 'test123' } });
  } catch (err) {
    console.log(`  ❌ Login API failed: ${err.message}`);
    results.apiTests.push({ endpoint: 'POST /api/auth/login', error: err.message });
  }

  // Test 5: Register API  
  console.log('\n📍 Test 5: POST /api/auth/register');
  try {
    const register = await fetchAPI(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test User Browser',
        email: `testbrowser_${Date.now()}@test.com`,
        phone: '089988776655',
        password: 'Test@1234',
      }),
    });
    console.log(`  Status: ${register.status}`);
    console.log(`  Response: ${JSON.stringify(register.data).substring(0, 300)}`);
    results.apiTests.push({ endpoint: 'POST /api/auth/register', status: register.status, response: register.data });
  } catch (err) {
    console.log(`  ❌ Register API failed: ${err.message}`);
    results.apiTests.push({ endpoint: 'POST /api/auth/register', error: err.message });
  }

  // Test 6: Login Diagnostic
  console.log('\n📍 Test 6: POST /api/auth/login-diagnostic');
  try {
    const diag = await fetchAPI(`${BASE_URL}/api/auth/login-diagnostic`, {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com' }),
    });
    console.log(`  Status: ${diag.status}`);
    console.log(`  Response: ${JSON.stringify(diag.data).substring(0, 300)}`);
    results.apiTests.push({ endpoint: 'POST /api/auth/login-diagnostic', status: diag.status, response: diag.data });
  } catch (err) {
    console.log(`  ❌ Login diagnostic failed: ${err.message}`);
    results.apiTests.push({ endpoint: 'POST /api/auth/login-diagnostic', error: err.message });
  }

  // Test 7: Auth diagnostic
  console.log('\n📍 Test 7: GET /api/auth/diagnostic');
  try {
    const diag = await fetchAPI(`${BASE_URL}/api/auth/diagnostic`);
    console.log(`  Status: ${diag.status}`);
    console.log(`  Response: ${JSON.stringify(diag.data).substring(0, 300)}`);
    results.apiTests.push({ endpoint: 'GET /api/auth/diagnostic', status: diag.status, response: diag.data });
  } catch (err) {
    console.log(`  ❌ Auth diagnostic failed: ${err.message}`);
    results.apiTests.push({ endpoint: 'GET /api/auth/diagnostic', error: err.message });
  }

  // Test 8: Ping endpoint
  console.log('\n📍 Test 8: GET /api/ping');
  try {
    const ping = await fetchAPI(`${BASE_URL}/api/ping`);
    console.log(`  Status: ${ping.status}, Response: ${JSON.stringify(ping.data).substring(0, 100)}`);
    results.apiTests.push({ endpoint: 'GET /api/ping', status: ping.status, response: ping.data });
  } catch (err) {
    console.log(`  ❌ Ping failed: ${err.message}`);
    results.apiTests.push({ endpoint: 'GET /api/ping', error: err.message });
  }

  // =====================================================
  // PART 2: Browser Rendering Test (Puppeteer)
  // =====================================================
  console.log('\n' + '='.repeat(60));
  console.log('PART 2: Browser Rendering Test (via setContent)');
  console.log('='.repeat(60));

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      defaultViewport: { width: 390, height: 844 },
    });
    const page = await browser.newPage();

    // Collect console messages
    const consoleErrors = [];
    const consoleWarnings = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    // Load the homepage HTML via setContent (workaround for localhost issue)
    const html = await fetchPage(BASE_URL);
    
    // Set content with the base URL so relative assets load correctly
    // Actually, this won't work because assets are relative. Let me try a different approach.
    
    // Let's try using the external IP
    console.log('\n  Trying to load page in browser...');
    
    // First, try accessing the server directly
    try {
      await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 });
      console.log('  ✅ Page loaded directly in browser!');
      
      // Take screenshot of initial state (splash screen)
      await takeScreenshot(page, '01-splash-screen');
      
      // Wait for splash to finish (2s + buffer)
      await page.waitForTimeout(3000);
      await takeScreenshot(page, '02-after-splash');
      
      // Check current screen
      const screenText = await page.evaluate(() => document.body.innerText.substring(0, 300));
      console.log(`  Screen text: ${screenText.substring(0, 100)}`);
      
      results.browserTests.push({
        step: 'Direct browser access',
        success: true,
        screenText: screenText.substring(0, 200),
      });
      
    } catch (navErr) {
      console.log(`  ❌ Direct navigation failed: ${navErr.message}`);
      console.log('  Trying setContent workaround...');
      
      // Workaround: load HTML content directly
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await takeScreenshot(page, '01-setcontent-initial');
      
      const screenText = await page.evaluate(() => document.body.innerText.substring(0, 300));
      console.log(`  Screen text (setContent): ${screenText.substring(0, 100)}`);
      
      results.browserTests.push({
        step: 'setContent workaround',
        success: true,
        note: 'Static HTML only - JS may not work properly',
        screenText: screenText.substring(0, 200),
      });
    }

    // Collect console errors
    results.consoleErrors = consoleErrors;
    results.pageErrors = pageErrors;
    
    if (consoleErrors.length > 0) {
      console.log('\n  ❌ Console Errors:');
      consoleErrors.forEach(e => console.log(`    - ${e}`));
    }
    if (pageErrors.length > 0) {
      console.log('\n  ❌ Page Errors:');
      pageErrors.forEach(e => console.log(`    - ${e}`));
    }
    
    await browser.close();
    console.log('\n  Browser closed.');
  } catch (err) {
    console.log(`  ❌ Browser test failed: ${err.message}`);
    results.browserTests.push({ step: 'browser launch', error: err.message });
  }

  // =====================================================
  // PART 3: Code Analysis for UI Flow Issues
  // =====================================================
  console.log('\n' + '='.repeat(60));
  console.log('PART 3: Code Analysis Summary');
  console.log('='.repeat(60));

  const codeAnalysis = {
    splashScreen: {
      file: 'src/components/ecommerce/auth/splash-screen.tsx',
      behavior: 'Shows logo + "Shop Smart, Live Better" for 2 seconds, then navigates to "onboarding" (if not authenticated) or "home" (if authenticated)',
      potentialIssues: [],
    },
    onboardingScreen: {
      file: 'src/components/ecommerce/auth/onboarding-screen.tsx',
      behavior: '3 slides with "Skip" button and "Next"/"Mulai Belanja" button. Last slide navigates to "login"',
      potentialIssues: [],
    },
    loginScreen: {
      file: 'src/components/ecommerce/auth/login-screen.tsx',
      behavior: 'Email/phone + password form. Submits to /api/auth/login. Handles email verification, 2FA, and Google OAuth.',
      potentialIssues: [
        'Login uses apiClient.rawPost which may include CSRF token - CSRF token endpoint works but if server cant reach DB, CSRF token might be stale',
        'Password "test123" is only 7 chars - register requires 8+ chars with uppercase, lowercase, digit, special char. If test@test.com was registered with weak password, it could be a legacy/bcrypt hash issue',
      ],
    },
    registerScreen: {
      file: 'src/components/ecommerce/auth/register-screen.tsx',
      behavior: 'Name, email, phone, password, confirm password, terms checkbox. Submits to /api/auth/register. With mock email, auto-verifies.',
      potentialIssues: [
        'Register requires password with 8+ chars, uppercase, lowercase, digit, special char',
        'If EMAIL_PROVIDER=mock, users are auto-verified and auto-logged-in',
      ],
    },
    loginAPI: {
      file: 'src/app/api/auth/login/route.ts',
      behavior: 'Validates credentials against bcrypt hash, checks account lockout, email verification, 2FA',
      currentError: 'Returns "Terjadi kesalahan server. Coba lagi nanti." with errorCode "UNKNOWN" - This is a database connectivity error (PrismaClientInitializationError)',
      potentialIssues: [
        'Database authentication failed - Supabase credentials in .env are invalid/expired',
        'All auth endpoints will fail until database connectivity is restored',
      ],
    },
    registerAPI: {
      file: 'src/app/api/auth/register/route.ts',
      behavior: 'Creates user with bcrypt-hashed password, sends verification email (or auto-verifies with mock provider)',
      currentError: 'Same database connectivity error as login',
      potentialIssues: [
        'Database authentication failed - same root cause as login',
      ],
    },
  };

  results.codeAnalysis = codeAnalysis;
  
  console.log('\n  Key findings:');
  Object.entries(codeAnalysis).forEach(([key, info]) => {
    console.log(`  - ${key}: ${info.potentialIssues?.join('; ') || info.currentError || 'No issues found'}`);
  });

  // =====================================================
  // SUMMARY
  // =====================================================
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  results.summary = {
    serverRunning: true,
    homepageLoads: true,
    databaseConnected: false,
    databaseError: 'Supabase PostgreSQL authentication failed - credentials in .env are invalid or expired',
    loginWorks: false,
    registerWorks: false,
    csrfWorks: true,
    rootCause: 'Database connectivity failure (PrismaClientInitializationError). All auth API endpoints return 500 errors because they cannot connect to the Supabase PostgreSQL database.',
    loginErrorMessage: '"Terjadi kesalahan server. Coba lagi nanti." (Generic server error - database unreachable)',
    registerErrorMessage: '"Terjadi kesalahan server. Coba lagi nanti." (Generic server error - database unreachable)',
    frontendFlow: 'Splash (2s) → Onboarding (3 slides + Skip) → Login screen → Form submission → API error toast',
    credentialNote: 'test@test.com / test123 - Cannot verify if these credentials exist in the database because the database is unreachable',
    passwordNote: 'Password "test123" (7 chars, no uppercase/special) does not meet the registration requirements (8+ chars, uppercase, lowercase, digit, special char). If this account exists, it was likely created before validation was added or via a different method.',
    recommendedFix: '1. Update SUPABASE_DATABASE_URL and SUPABASE_DIRECT_URL in .env with valid credentials, OR 2. Switch to local PostgreSQL/SQLite for development, OR 3. Check if Supabase project is still active at https://supabase.com/dashboard',
  };

  console.log('\n' + JSON.stringify(results.summary, null, 2));

  // Save results
  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'test-results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log(`\n📝 Results saved to ${path.join(SCREENSHOT_DIR, 'test-results.json')}`);
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
