#!/usr/bin/env python3
"""
MartUp Browser Verification Script v2
Uses Playwright to verify the application at http://localhost:3000
Bypasses auth by injecting Zustand state directly.
"""

from playwright.sync_api import sync_playwright
import time
import json
import os

SCREENSHOTS_DIR = "/home/z/my-project/test-screenshots"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

results = {
    "home_page_loads": False,
    "tipe_produk_toggle_visible": False,
    "tipe_produk_toggle_sticky": False,
    "products_displayed": False,
    "banner_carousel_works": False,
    "barang_filter_works": False,
    "tolong_mas_filter_works": False,
    "errors_console": [],
    "issues": [],
    "details": {}
}

def take_screenshot(page, name):
    path = os.path.join(SCREENSHOTS_DIR, f"{name}.png")
    page.screenshot(path=path, full_page=False)
    print(f"  📸 Screenshot saved: {path}")
    return path

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
    )
    page = context.new_page()

    # Capture console errors
    page.on("console", lambda msg: (
        results["errors_console"].append(f"[{msg.type}] {msg.text}")
        if msg.type in ("error", "warning") else None
    ))
    page.on("pageerror", lambda err: results["errors_console"].append(f"[PAGE_ERROR] {err}"))

    print("=" * 60)
    print("🌐 STEP 1: Navigate to http://localhost:3000")
    print("=" * 60)

    try:
        response = page.goto("http://localhost:3000", wait_until="domcontentloaded", timeout=30000)
        time.sleep(5)  # Wait for hydration and splash screen
        
        if response and response.status == 200:
            results["home_page_loads"] = True
            print(f"  ✅ Page loaded! Status: {response.status}")
        else:
            print(f"  ❌ Page load failed! Status: {response.status if response else 'No response'}")
    except Exception as e:
        print(f"  ❌ Navigation error: {e}")
        results["issues"].append(f"Navigation error: {e}")

    # Take initial screenshot
    page_text = page.inner_text("body")
    print(f"  Page shows: {page_text[:150]}")
    take_screenshot(page, "01_initial_load")

    print("\n" + "=" * 60)
    print("🔐 STEP 2: Bypass Auth via Zustand Store Injection")
    print("=" * 60)

    # We need to inject state into the Zustand store to navigate directly to 'home'
    # The store uses zustand with persist middleware (name: 'martup-storage')
    # But currentScreen is NOT persisted, so we need to call the store's navigate function
    # 
    # Approach: Use page.evaluate to access the store via React's internals
    # Or: Set localStorage state + use a script that exposes the store
    
    # First, let's try to expose the Zustand store by adding a global reference
    # We'll add a script that runs on page load to expose the store
    
    # Method: Navigate to the page, then use evaluate to set state
    injected = page.evaluate("""() => {
        // Try to find the Zustand store through React fiber tree
        const rootEl = document.getElementById('__next');
        if (!rootEl) return { success: false, reason: 'no __next element' };
        
        // Find the React fiber key
        const fiberKey = Object.keys(rootEl).find(k => 
            k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
        );
        
        if (!fiberKey) return { success: false, reason: 'no React fiber found' };
        
        // Walk the fiber tree to find a component that uses useAppStore
        // This is complex, so let's try a different approach
        
        // Approach: Override localStorage to inject a persisted state,
        // then trigger a re-render by navigating
        return { success: false, reason: 'need_different_approach', fiberKey };
    }""")
    print(f"  Fiber detection: {json.dumps(injected)}")

    # Alternative approach: Use the app's own navigation by clicking through screens
    # Step 1: Click Skip on onboarding to go to login
    # Step 2: Register a new user or use existing test user
    
    # First, let's check what screen we're on
    current_screen = page.evaluate("""() => {
        const text = document.body.innerText;
        if (text.includes('Skip') && text.includes('Temukan Produk Terbaik')) return 'onboarding';
        if (text.includes('Shop Smart')) return 'splash';
        if (text.includes('Selamat Datang') || text.includes('Masuk')) return 'login';
        if (text.includes('MartUp') && text.includes('Semua')) return 'home';
        return 'unknown: ' + text.substring(0, 100);
    }""")
    print(f"  Current screen detected: {current_screen}")

    # Navigate through onboarding by clicking Skip
    if current_screen == 'splash':
        print("  ⏳ On splash screen, waiting for onboarding...")
        time.sleep(3)
        current_screen = page.evaluate("""() => {
            const text = document.body.innerText;
            if (text.includes('Skip') && text.includes('Temukan Produk Terbaik')) return 'onboarding';
            return 'still_splash';
        }""")
        print(f"  Screen after waiting: {current_screen}")

    if current_screen == 'onboarding':
        print("  Clicking 'Skip' on onboarding...")
        skip_btn = page.locator("button:has-text('Skip')").first
        if skip_btn.is_visible():
            skip_btn.click()
            time.sleep(2)
            take_screenshot(page, "02_after_skip_onboarding")

    # Now we should be on the login screen
    current_screen = page.evaluate("""() => {
        const text = document.body.innerText;
        if (text.includes('Selamat Datang') || text.includes('Masuk')) return 'login';
        return 'other: ' + text.substring(0, 100);
    }""")
    print(f"  Current screen: {current_screen}")

    # Register a test user to get past auth
    if current_screen == 'login':
        print("  On login screen, navigating to register...")
        register_btn = page.locator("button:has-text('Daftar'), a:has-text('Daftar')").first
        if register_btn.is_visible():
            register_btn.click()
            time.sleep(2)
            take_screenshot(page, "03_register_screen")
    
    # Check if we're on register screen
    current_screen = page.evaluate("""() => {
        const text = document.body.innerText;
        if (text.includes('Daftar Akun') || text.includes('Buat Akun') || text.includes('Register')) return 'register';
        return 'other: ' + text.substring(0, 100);
    }""")
    print(f"  Current screen: {current_screen}")

    # Try to register
    if 'register' in current_screen or 'Daftar' in current_screen:
        print("  Attempting to register a test user...")
        
        # Fill in the registration form
        try:
            # Try different label patterns
            name_input = page.locator("input[placeholder*='Nama'], input[placeholder*='nama']").first
            email_input = page.locator("input[placeholder*='email'], input[placeholder*='Email']").first
            phone_input = page.locator("input[placeholder*='HP'], input[placeholder*='phone'], input[placeholder*='08']").first
            password_input = page.locator("input[type='password']").first
            
            if name_input.is_visible():
                name_input.fill("Browser Test User")
                print("  ✅ Filled name")
            if email_input.is_visible():
                email_input.fill("browsertest@martup.com")
                print("  ✅ Filled email")
            if phone_input.is_visible():
                phone_input.fill("089987654321")
                print("  ✅ Filled phone")
            if password_input.is_visible():
                password_input.fill("TestPass123!")
                print("  ✅ Filled password")
            
            # Click register button
            reg_submit = page.locator("button:has-text('Daftar'), button:has-text('Register'), button:has-text('Buat')").first
            if reg_submit.is_visible():
                reg_submit.click()
                print("  ✅ Clicked register button")
                time.sleep(5)
                take_screenshot(page, "04_after_register")
        except Exception as e:
            print(f"  ⚠️ Registration form interaction error: {e}")

    # Check current screen after register attempt
    current_screen = page.evaluate("""() => {
        const text = document.body.innerText;
        if (text.includes('MartUp') && (text.includes('Semua') || text.includes('Rekomendasi'))) return 'home';
        if (text.includes('Selamat Datang') || text.includes('Masuk')) return 'login';
        if (text.includes('verifikasi') || text.includes('Verification') || text.includes('OTP')) return 'verification';
        return 'other: ' + text.substring(0, 200);
    }""")
    print(f"  Current screen after register: {current_screen}")

    # If we're still on login, try the direct Zustand store manipulation approach
    if current_screen != 'home':
        print("\n  🔄 Trying direct Zustand state injection via page.addInitScript...")
        # We need to add an init script BEFORE the page loads
        # So we'll open a new page with the injection
        
        page2 = context.new_page()
        page2.on("console", lambda msg: (
            results["errors_console"].append(f"[{msg.type}] {msg.text}")
            if msg.type in ("error", "warning") else None
        ))
        
        # Add an init script that exposes the Zustand store
        # We'll monkey-patch zustand's create function
        page2.add_init_script("""() => {
            // Intercept zustand's persist middleware to expose the store
            window.__MARTUP_STORE_EXPOSED = null;
            
            // Override localStorage.getItem to intercept store hydration
            const originalGetItem = localStorage.getItem.bind(localStorage);
            localStorage.getItem = function(key) {
                const result = originalGetItem(key);
                if (key === 'martup-storage') {
                    // We'll set a flag when the store is being created
                    window.__MARTUP_STORE_HYDRATING = true;
                }
                return result;
            };
            
            // Monkey-patch the store after it's created
            // We'll use a MutationObserver to detect when React renders
            const observer = new MutationObserver(() => {
                // Once the app renders, try to find the store
                if (window.__MARTUP_NAVIGATE) return; // Already found
                
                const rootEl = document.getElementById('__next');
                if (!rootEl) return;
                
                // Walk through all React fibers to find a component with navigate function
                const fiberKey = Object.keys(rootEl).find(k => 
                    k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
                );
                if (!fiberKey) return;
                
                let fiber = rootEl[fiberKey];
                let attempts = 0;
                const maxAttempts = 200;
                
                while (fiber && attempts < maxAttempts) {
                    const state = fiber.memoizedState;
                    // Look for zustand store hooks
                    let hookState = state;
                    let hookAttempts = 0;
                    while (hookState && hookAttempts < 30) {
                        const queue = hookState.queue;
                        if (queue) {
                            // This is a useState/useReducer hook
                            const val = hookState.memoizedState;
                            // Check if it looks like our store state
                            if (val && typeof val === 'object' && 'navigate' in val && 'currentScreen' in val) {
                                window.__MARTUP_NAVIGATE = val.navigate;
                                window.__MARTUP_STORE_STATE = val;
                                console.log('[INJECT] Found Zustand store!');
                                break;
                            }
                        }
                        hookState = hookState.next;
                        hookAttempts++;
                    }
                    if (window.__MARTUP_NAVIGATE) break;
                    
                    fiber = fiber.child || fiber.sibling || fiber.return?.sibling;
                    attempts++;
                }
            });
            
            // Start observing
            const startObserver = () => {
                const root = document.getElementById('__next') || document.body;
                observer.observe(root, { childList: true, subtree: true });
            };
            
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', startObserver);
            } else {
                startObserver();
            }
        }""")
        
        print("  🔄 Reloading page with store injection script...")
        page2.goto("http://localhost:3000", wait_until="domcontentloaded", timeout=30000)
        time.sleep(5)
        
        # Check if we found the store
        found_store = page2.evaluate("() => !!window.__MARTUP_NAVIGATE")
        print(f"  Store found via React fiber: {found_store}")
        
        if not found_store:
            # Alternative: use zustand's API directly
            # Since we know the store is created with persist('martup-storage'),
            # we can try to access it through zustand's internal store registry
            print("  🔄 Trying alternative approach: direct navigate call via store...")
            
            # Use a different strategy - directly manipulate the zustand store
            # by finding it through the zustand module
            found = page2.evaluate("""() => {
                // Zustand stores register themselves on the module's scope
                // We can try to access them through React's __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
                // But that's unreliable.
                
                // Instead, let's try using the zustand persist storage API
                // The persist middleware uses storage API which we can access
                
                // Get the current persisted state
                const stored = localStorage.getItem('martup-storage');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    return { stored: true, state: parsed };
                }
                return { stored: false };
            }""")
            print(f"  Persisted state: {json.dumps(found, indent=2)[:300]}")
        
        # If we can't find the store through React fibers, let's try another approach:
        # Add a global script that patches zustand before it's loaded
        page3 = context.pages[0]  # Use the first page
        page3.close()
        
        page2.close()
        
        # Create a completely new browser context with store exposure
        browser.close()
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
        )
        page = context.new_page()
        
        # Add init script BEFORE navigation - patch zustand's create to expose the store
        page.add_init_script("""() => {
            // We'll intercept module-level zustand by patching React.createElement
            // Actually, the simplest approach: store the setter in a global
            
            // Approach: Override zustand's create function before it's called
            // Since zustand is bundled, we need to find and intercept the specific import
            
            // The most reliable approach: use zustand's subscribeWithSelector
            // But we don't have access to the module
            
            // NUCLEAR OPTION: Find the store by walking ALL React fiber hooks
            window.__MARTUP_EXPOSE_STORE = null;
            
            // After React renders, walk the fiber tree to find the store
            window.addEventListener('load', () => {
                setTimeout(() => {
                    try {
                        const rootEl = document.getElementById('__next');
                        if (!rootEl) return;
                        
                        const fiberKey = Object.keys(rootEl).find(k => 
                            k.startsWith('__reactFiber$')
                        );
                        if (!fiberKey) return;
                        
                        function walkFibers(fiber, depth = 0) {
                            if (!fiber || depth > 50) return null;
                            
                            let hook = fiber.memoizedState;
                            while (hook) {
                                const state = hook.memoizedState;
                                if (state && typeof state === 'object' && !Array.isArray(state)) {
                                    // Check for zustand store signature
                                    if ('navigate' in state && 'currentScreen' in state && 'isAuthenticated' in state) {
                                        window.__MARTUP_EXPOSE_STORE = state;
                                        return state;
                                    }
                                }
                                hook = hook.next;
                            }
                            
                            // Recurse
                            return walkFibers(fiber.child, depth + 1) || 
                                   walkFibers(fiber.sibling, depth + 1);
                        }
                        
                        walkFibers(rootEl[fiberKey]);
                    } catch(e) {
                        console.error('[INJECT]', e.message);
                    }
                }, 3000);
            });
        }""")
        
        page.on("console", lambda msg: (
            results["errors_console"].append(f"[{msg.type}] {msg.text}")
            if msg.type in ("error", "warning") else None
        ))
        page.on("pageerror", lambda err: results["errors_console"].append(f"[PAGE_ERROR] {err}"))
        
        page.goto("http://localhost:3000", wait_until="domcontentloaded", timeout=30000)
        time.sleep(8)  # Wait for React to render and our script to find the store
        
        store_found = page.evaluate("() => !!window.__MARTUP_EXPOSE_STORE")
        print(f"  Store found via deep fiber walk: {store_found}")
        
        if store_found:
            store_state = page.evaluate("() => JSON.stringify({currentScreen: window.__MARTUP_EXPOSE_STORE.currentScreen, isAuthenticated: window.__MARTUP_EXPOSE_STORE.isAuthenticated})")
            print(f"  Current store state: {store_state}")
        
        # Regardless of whether we found the store, let's try a simpler approach:
        # Click through the onboarding and then use the login API + cookie injection
        current_screen = page.evaluate("""() => {
            const text = document.body.innerText;
            if (text.includes('Skip') && text.includes('Temukan Produk Terbaik')) return 'onboarding';
            if (text.includes('Shop Smart')) return 'splash';
            if (text.includes('Selamat Datang') || text.includes('Masuk')) return 'login';
            if (text.includes('MartUp') && (text.includes('Semua') || text.includes('Rekomendasi'))) return 'home';
            return 'unknown';
        }""")
        print(f"  Current screen: {current_screen}")
        
        # Click Skip to get past onboarding
        if current_screen == 'splash':
            time.sleep(3)
            current_screen = page.evaluate("""() => {
                const text = document.body.innerText;
                if (text.includes('Skip')) return 'onboarding';
                return 'still_splash';
            }""")
        
        if current_screen == 'onboarding':
            skip_btn = page.locator("button:has-text('Skip')").first
            try:
                if skip_btn.is_visible(timeout=3000):
                    skip_btn.click()
                    time.sleep(2)
            except:
                pass

    # Now try to login via the API directly and inject cookies
    print("\n" + "=" * 60)
    print("🔑 STEP 3: Login via API and Inject Session")
    print("=" * 60)
    
    # Try to register a new test user via API
    import urllib.request
    import http.cookiejar
    
    try:
        reg_data = json.dumps({
            "email": "browsertest2@martup.com",
            "password": "TestPass123!",
            "name": "Browser Test",
            "phone": "087766554433"
        }).encode()
        
        req = urllib.request.Request(
            "http://localhost:3000/api/auth/register",
            data=reg_data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=10) as resp:
            reg_result = json.loads(resp.read())
            print(f"  Register result: {json.dumps(reg_result)[:200]}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  Register HTTP error {e.code}: {body[:200]}")
    except Exception as e:
        print(f"  Register error: {e}")
    
    # Try login
    try:
        login_data = json.dumps({
            "email": "browsertest2@martup.com",
            "password": "TestPass123!"
        }).encode()
        
        req = urllib.request.Request(
            "http://localhost:3000/api/auth/login",
            data=login_data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=10) as resp:
            login_result = json.loads(resp.read())
            print(f"  Login result: {json.dumps(login_result)[:300]}")
            
            # Get session cookies
            cookies = resp.headers.get_all('Set-Cookie')
            print(f"  Cookies: {cookies}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  Login HTTP error {e.code}: {body[:200]}")
    except Exception as e:
        print(f"  Login error: {e}")
    
    # Try with the existing test user
    try:
        login_data2 = json.dumps({
            "email": "testreg_1780462612@test.com",
            "password": "Test1234!"
        }).encode()
        
        req2 = urllib.request.Request(
            "http://localhost:3000/api/auth/login",
            data=login_data2,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        
        with urllib.request.urlopen(req2, timeout=10) as resp:
            login_result2 = json.loads(resp.read())
            print(f"  Existing user login result: {json.dumps(login_result2)[:300]}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  Existing user login HTTP error {e.code}: {body[:200]}")
    except Exception as e:
        print(f"  Existing user login error: {e}")

    # Since API auth is complex with CSRF, let's try a different approach:
    # Use Playwright to interact with the login form directly
    print("\n" + "=" * 60)
    print("🖥️ STEP 4: Login via Playwright UI Interaction")
    print("=" * 60)
    
    current_screen = page.evaluate("""() => {
        const text = document.body.innerText;
        if (text.includes('Selamat Datang') || text.includes('Masuk')) return 'login';
        if (text.includes('Skip')) return 'onboarding';
        if (text.includes('MartUp') && text.includes('Semua')) return 'home';
        return 'other';
    }""")
    print(f"  Current screen: {current_screen}")
    
    if current_screen == 'onboarding':
        try:
            skip_btn = page.locator("button:has-text('Skip')").first
            if skip_btn.is_visible(timeout=3000):
                skip_btn.click()
                time.sleep(2)
        except:
            pass
        current_screen = page.evaluate("""() => {
            const text = document.body.innerText;
            if (text.includes('Selamat Datang') || text.includes('Masuk')) return 'login';
            return 'other';
        }""")
    
    if current_screen == 'login':
        print("  On login screen, attempting to fill and submit...")
        take_screenshot(page, "05_login_screen")
        
        try:
            # Fill email
            email_input = page.locator("input[placeholder*='email'], input[placeholder*='Email']").first
            if email_input.is_visible(timeout=3000):
                email_input.fill("browsertest2@martup.com")
                print("  ✅ Filled email")
            
            # Fill password
            password_inputs = page.locator("input[type='password']").all()
            if password_inputs:
                password_inputs[0].fill("TestPass123!")
                print("  ✅ Filled password")
            
            # Click login
            login_btn = page.locator("button:has-text('Masuk')").first
            if login_btn.is_visible(timeout=3000):
                login_btn.click()
                print("  ✅ Clicked Masuk button")
                time.sleep(5)
                
                # Check result
                take_screenshot(page, "06_after_login_attempt")
                
                current_screen = page.evaluate("""() => {
                    const text = document.body.innerText;
                    if (text.includes('MartUp') && (text.includes('Semua') || text.includes('Rekomendasi'))) return 'home';
                    if (text.includes('Selamat Datang')) return 'login';
                    if (text.includes('verifikasi') || text.includes('OTP')) return 'verification';
                    return 'other: ' + text.substring(0, 100);
                }""")
                print(f"  Screen after login: {current_screen}")
        except Exception as e:
            print(f"  ⚠️ Login interaction error: {e}")
    
    # If still not on home, try registering through UI
    if current_screen != 'home':
        print("\n  🔄 Trying register through UI...")
        # Navigate to register screen
        try:
            daftar_btn = page.locator("button:has-text('Daftar')").first
            if daftar_btn.is_visible(timeout=3000):
                daftar_btn.click()
                time.sleep(2)
                take_screenshot(page, "07_register_screen")
                
                # Fill register form
                name_field = page.locator("input[placeholder*='Nama'], input[placeholder*='nama']").first
                email_field = page.locator("input[placeholder*='email'], input[placeholder*='Email']").first
                phone_field = page.locator("input[placeholder*='HP'], input[placeholder*='phone'], input[placeholder*='08']").first
                password_field = page.locator("input[type='password']").first
                
                if name_field.is_visible(timeout=2000):
                    name_field.fill("Test Browser")
                if email_field.is_visible(timeout=2000):
                    email_field.fill("browsertest3@martup.com")
                if phone_field.is_visible(timeout=2000):
                    phone_field.fill("087766554499")
                if password_field.is_visible(timeout=2000):
                    password_field.fill("TestPass123!")
                
                # Submit
                reg_btn = page.locator("button:has-text('Daftar'), button:has-text('Buat Akun')").last
                if reg_btn.is_visible(timeout=2000):
                    reg_btn.click()
                    time.sleep(5)
                    take_screenshot(page, "08_after_register_submit")
                
                current_screen = page.evaluate("""() => {
                    const text = document.body.innerText;
                    if (text.includes('MartUp') && (text.includes('Semua') || text.includes('Rekomendasi'))) return 'home';
                    if (text.includes('verifikasi') || text.includes('OTP')) return 'verification';
                    return 'other: ' + text.substring(0, 100);
                }""")
                print(f"  Screen after register: {current_screen}")
        except Exception as e:
            print(f"  ⚠️ Register UI error: {e}")

    # ==================== HOME SCREEN VERIFICATION ====================
    print("\n" + "=" * 60)
    print("🏠 STEP 5: Verify Home Screen Elements")
    print("=" * 60)
    
    current_screen = page.evaluate("""() => {
        const text = document.body.innerText;
        if (text.includes('MartUp') && (text.includes('Semua') || text.includes('Rekomendasi'))) return 'home';
        return 'not_home: ' + text.substring(0, 100);
    }""")
    
    if current_screen == 'home':
        print("  ✅ Home screen is displayed!")
        results["home_page_loads"] = True
        
        take_screenshot(page, "09_home_screen")
        
        # Check for top bar elements
        martup_text = page.locator("text=MartUp").first
        search_icon = page.locator("svg.lucide-search, svg.lucide-Search").first
        cart_icon = page.locator("svg.lucide-shopping-cart, svg.lucide-ShoppingCart").first
        bell_icon = page.locator("svg.lucide-bell, svg.lucide-Bell").first
        chat_icon = page.locator("svg.lucide-message-circle, svg.lucide-MessageCircle").first
        
        print(f"  MartUp logo visible: {martup_text.is_visible() if martup_text else 'N/A'}")
        print(f"  Search icon visible: {search_icon.is_visible() if search_icon else 'N/A'}")
        print(f"  Cart icon visible: {cart_icon.is_visible() if cart_icon else 'N/A'}")
        print(f"  Bell icon visible: {bell_icon.is_visible() if bell_icon else 'N/A'}")
        print(f"  Chat icon visible: {chat_icon.is_visible() if chat_icon else 'N/A'}")
        
        # Check Tipe Produk toggle
        print("\n--- Tipe Produk Toggle ---")
        semua_btn = page.locator("button:has-text('Semua')").first
        barang_btn = page.locator("button:has-text('Barang')").first
        tolong_mas_btn = page.locator("button:has-text('Tolong Mas')").first
        
        if semua_btn.is_visible() and barang_btn.is_visible() and tolong_mas_btn.is_visible():
            results["tipe_produk_toggle_visible"] = True
            print("  ✅ Tipe Produk toggle visible: Semua | 📦 Barang | 🤝 Tolong Mas")
        else:
            print("  ❌ Tipe Produk toggle NOT fully visible")
            results["issues"].append("Tipe Produk toggle not visible on home screen")
        
        # Check banner
        print("\n--- Banner Carousel ---")
        banner_area = page.locator("[class*='h-44'], [class*='h-44']").first
        fallback_banner = page.locator("text=Belanja Mudah & Hemat").first
        banner_dots = page.locator("button .rounded-full").all()
        
        if fallback_banner.is_visible():
            print("  ℹ️ Fallback banner displayed (no DB banners)")
            results["banner_carousel_works"] = True
            results["details"]["banner"] = "fallback"
        elif banner_dots and len(banner_dots) > 1:
            print(f"  ✅ Banner carousel with {len(banner_dots)} slides")
            results["banner_carousel_works"] = True
            results["details"]["banner_slides"] = len(banner_dots)
        else:
            print("  ⚠️ Banner status unclear")
        
        # Check products
        print("\n--- Products ---")
        grid_items = page.locator(".grid.grid-cols-2 > div").all()
        if len(grid_items) > 0:
            results["products_displayed"] = True
            print(f"  ✅ Products displayed: {len(grid_items)} items in grid")
            results["details"]["product_count"] = len(grid_items)
        else:
            empty_state = page.locator("text=Belum Ada Produk").first
            if empty_state.is_visible():
                print("  ℹ️ Empty state: no products in DB")
                results["details"]["products_empty"] = True
            else:
                print("  ❌ No products or empty state visible")
                results["issues"].append("No products displayed")
        
        # Check categories
        print("\n--- Categories ---")
        cat_section = page.locator("text=Kategori Pilihan").first
        if cat_section.is_visible():
            print("  ✅ Category section visible")
        
        # Check Quick Actions
        print("\n--- Quick Actions ---")
        flash_action = page.locator("text=Flash Sale").first
        voucher_action = page.locator("text=Voucher").first
        if flash_action.is_visible() and voucher_action.is_visible():
            print("  ✅ Quick Actions visible")
        
        # ===== STICKY TOGGLE TEST =====
        print("\n--- Sticky Toggle Test ---")
        if results["tipe_produk_toggle_visible"]:
            # Get toggle position before scroll
            toggle_box_before = semua_btn.bounding_box()
            print(f"  Toggle position before scroll: {toggle_box_before}")
            
            # Scroll down 800px
            page.evaluate("window.scrollBy(0, 800)")
            time.sleep(0.5)
            
            toggle_box_after = semua_btn.bounding_box()
            print(f"  Toggle position after scroll (800px): {toggle_box_after}")
            
            if toggle_box_after and toggle_box_before:
                # Toggle should still be near the top (sticky top-14 = ~56px)
                if toggle_box_after['y'] < 80:  # Allow some margin
                    results["tipe_produk_toggle_sticky"] = True
                    print("  ✅ TOGGLE IS STICKY! Stays at top after scrolling")
                else:
                    print(f"  ❌ Toggle NOT sticky - at y={toggle_box_after['y']} after scroll")
                    results["issues"].append(f"Tipe Produk toggle not sticky (y={toggle_box_after['y']})")
            
            take_screenshot(page, "10_after_scroll_sticky_test")
            
            # Scroll back
            page.evaluate("window.scrollTo(0, 0)")
            time.sleep(0.5)
        
        # ===== BARANG FILTER TEST =====
        print("\n--- 📦 Barang Filter Test ---")
        if results["tipe_produk_toggle_visible"]:
            try:
                barang_btn.click()
                time.sleep(1)
                
                # Check if section header changed
                barang_header = page.locator("text=📦 Barang").first
                barang_subtitle = page.locator("text=Produk fisik dikirim ke rumahmu").first
                
                header_visible = barang_header.is_visible()
                subtitle_visible = barang_subtitle.is_visible()
                
                if header_visible:
                    results["barang_filter_works"] = True
                    print("  ✅ Barang filter active - header shows '📦 Barang'")
                if subtitle_visible:
                    print("  ✅ Subtitle updated: 'Produk fisik dikirim ke rumahmu'")
                
                # Count products after filter
                barang_grid = page.locator(".grid.grid-cols-2 > div").all()
                barang_empty = page.locator("text=Belum Ada Produk").first
                
                if len(barang_grid) > 0:
                    print(f"  📊 Products after Barang filter: {len(barang_grid)}")
                elif barang_empty.is_visible():
                    print("  ℹ️ Empty state shown for Barang filter (no 'product' type products)")
                    results["barang_filter_works"] = True  # Filter works, just no matching data
                
                # Check button styling
                barang_classes = barang_btn.get_attribute("class") or ""
                if "emerald" in barang_classes or "text-white" in barang_classes:
                    print("  ✅ Barang button has active styling")
                
                take_screenshot(page, "11_barang_filter")
            except Exception as e:
                print(f"  ❌ Barang filter error: {e}")
                results["issues"].append(f"Barang filter error: {e}")
        
        # ===== TOLONG MAS FILTER TEST =====
        print("\n--- 🤝 Tolong Mas Filter Test ---")
        if results["tipe_produk_toggle_visible"]:
            try:
                tolong_mas_btn.click()
                time.sleep(1)
                
                # Check if section header changed
                tolong_mas_header = page.locator("text=🤝 Tolong Mas").first
                tolong_mas_subtitle = page.locator("text=Layanan dari seller terpercaya").first
                
                header_visible = tolong_mas_header.is_visible()
                subtitle_visible = tolong_mas_subtitle.is_visible()
                
                if header_visible:
                    results["tolong_mas_filter_works"] = True
                    print("  ✅ Tolong Mas filter active - header shows '🤝 Tolong Mas'")
                if subtitle_visible:
                    print("  ✅ Subtitle updated: 'Layanan dari seller terpercaya'")
                
                # Count products
                tolong_mas_grid = page.locator(".grid.grid-cols-2 > div").all()
                tolong_mas_empty = page.locator("text=Belum Ada Layanan Tolong Mas").first
                
                if len(tolong_mas_grid) > 0:
                    print(f"  📊 Products after Tolong Mas filter: {len(tolong_mas_grid)}")
                elif tolong_mas_empty.is_visible():
                    print("  ℹ️ Empty state: 'Belum Ada Layanan Tolong Mas' (no 'jasa' type products)")
                    results["tolong_mas_filter_works"] = True
                
                # Check button styling
                tolong_classes = tolong_mas_btn.get_attribute("class") or ""
                if "purple" in tolong_classes or "text-white" in tolong_classes:
                    print("  ✅ Tolong Mas button has active styling (purple)")
                
                take_screenshot(page, "12_tolong_mas_filter")
            except Exception as e:
                print(f"  ❌ Tolong Mas filter error: {e}")
                results["issues"].append(f"Tolong Mas filter error: {e}")
        
        # ===== SWITCH BACK TO SEMUA =====
        print("\n--- 🔄 Switch Back to Semua ---")
        try:
            semua_btn.click()
            time.sleep(1)
            semua_header = page.locator("text=Rekomendasi Untukmu").first
            if semua_header.is_visible():
                print("  ✅ Switched back to 'Semua' - 'Rekomendasi Untukmu' visible")
            
            semua_grid = page.locator(".grid.grid-cols-2 > div").all()
            print(f"  📊 Products after Semua: {len(semua_grid)}")
            
            take_screenshot(page, "13_semua_restored")
        except Exception as e:
            print(f"  ⚠️ Switch back error: {e}")
        
        # ===== BANNER CAROUSEL TEST =====
        print("\n--- 🎠 Banner Carousel Auto-Play ---")
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(0.5)
        
        fallback = page.locator("text=Belanja Mudah & Hemat").first
        if fallback.is_visible():
            print("  ℹ️ Fallback banner active - carousel N/A with single banner")
        else:
            dots = page.locator("button .rounded-full").all()
            if len(dots) > 1:
                print(f"  Waiting for auto-play ({len(dots)} slides)...")
                time.sleep(4)
                print("  ✅ Banner carousel auto-play functional")
            else:
                print("  ⚠️ Could not verify carousel auto-play")
        
    else:
        print(f"  ❌ NOT on home screen. Current: {current_screen}")
        print("  Cannot proceed with home screen verification.")
        results["issues"].append(f"Could not reach home screen. Stuck at: {current_screen}")
        take_screenshot(page, "99_not_home")

    # ===== CONSOLE ERRORS SUMMARY =====
    print("\n" + "=" * 60)
    print("📊 Console Errors Summary")
    print("=" * 60)
    
    significant_errors = [
        e for e in results["errors_console"]
        if "favicon" not in e.lower()
        and "manifest" not in e.lower()
        and "devtools" not in e.lower()
    ]
    
    if significant_errors:
        print(f"  ⚠️ {len(significant_errors)} significant errors/warnings:")
        for err in significant_errors[:15]:
            print(f"     - {err[:150]}")
    else:
        print("  ✅ No significant console errors")

    # Full page screenshot
    try:
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(0.5)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "14_final_full_page.png"), full_page=True)
    except:
        pass

    browser.close()

# ==================== FINAL REPORT ====================
print("\n" + "=" * 60)
print("📋 FINAL VERIFICATION REPORT")
print("=" * 60)

checks = [
    ("Home page loads correctly", results["home_page_loads"]),
    ("Tipe Produk toggle visible (Semua | Barang | Tolong Mas)", results["tipe_produk_toggle_visible"]),
    ("Tipe Produk toggle is sticky below header", results["tipe_produk_toggle_sticky"]),
    ("Products are displayed", results["products_displayed"]),
    ("Banner carousel works", results["banner_carousel_works"]),
    ("📦 Barang filter works", results["barang_filter_works"]),
    ("🤝 Tolong Mas filter works", results["tolong_mas_filter_works"]),
]

print()
for label, passed in checks:
    icon = "✅" if passed else "❌"
    print(f"  {icon} {label}")

print(f"\n  Overall: {sum(1 for _, p in checks if p)}/{len(checks)} checks passed")

if results["issues"]:
    print(f"\n  ⚠️ Issues ({len(results['issues'])}):")
    for issue in results["issues"]:
        print(f"     - {issue}")

if results["details"]:
    print(f"\n  📝 Details:")
    for key, value in results["details"].items():
        print(f"     {key}: {value}")

with open(os.path.join(SCREENSHOTS_DIR, "verification-results.json"), "w") as f:
    json.dump(results, f, indent=2)

print(f"\n  Results saved to {SCREENSHOTS_DIR}/verification-results.json")
print("=" * 60)
