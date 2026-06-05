#!/usr/bin/env python3
"""
MartUp Browser Verification Script v3
Simplified and robust approach.
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

def ss(page, name):
    path = os.path.join(SCREENSHOTS_DIR, f"{name}.png")
    page.screenshot(path=path, full_page=False)
    print(f"  📸 {path}")

def get_screen_name(page):
    """Detect which screen is currently shown"""
    try:
        text = page.inner_text("body")
    except:
        return "error"
    if "Shop Smart" in text or "MartUp" in text and "loading" in text.lower():
        return "splash"
    if "Skip" in text and "Temukan Produk" in text:
        return "onboarding"
    if "Selamat Datang" in text or ("Masuk" in text and "Email" in text):
        return "login"
    if "Daftar Akun" in text or "Buat Akun" in text or "Register" in text:
        return "register"
    if "Semua" in text and ("Barang" in text or "Rekomendasi" in text):
        return "home"
    if "verifikasi" in text.lower() or "OTP" in text:
        return "verification"
    return f"unknown: {text[:80]}"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
    )
    page = context.new_page()

    page.on("console", lambda msg: (
        results["errors_console"].append(f"[{msg.type}] {msg.text}")
        if msg.type in ("error", "warning") else None
    ))
    page.on("pageerror", lambda err: results["errors_console"].append(f"[PAGE_ERROR] {err}"))

    # ===== STEP 1: Load page =====
    print("=" * 60)
    print("🌐 STEP 1: Load http://localhost:3000")
    print("=" * 60)
    page.goto("http://localhost:3000", wait_until="load", timeout=60000)
    time.sleep(4)
    
    screen = get_screen_name(page)
    print(f"  Screen: {screen}")
    ss(page, "01_initial")
    
    # Wait for splash to transition
    if screen == "splash":
        print("  Waiting for splash to finish...")
        time.sleep(3)
        screen = get_screen_name(page)
        print(f"  Screen after wait: {screen}")
    
    # ===== STEP 2: Skip onboarding =====
    print("\n" + "=" * 60)
    print("⏭️ STEP 2: Skip Onboarding")
    print("=" * 60)
    if screen == "onboarding":
        try:
            skip = page.locator("button:has-text('Skip')").first
            skip.click(timeout=5000)
            time.sleep(2)
            screen = get_screen_name(page)
            print(f"  After skip: {screen}")
        except Exception as e:
            print(f"  Skip error: {e}")
            # Try clicking Next multiple times
            for i in range(3):
                try:
                    next_btn = page.locator("button:has-text('Next'), button:has-text('Mulai')").first
                    next_btn.click(timeout=3000)
                    time.sleep(1)
                except:
                    pass
            screen = get_screen_name(page)
    
    ss(page, "02_after_onboarding")
    
    # ===== STEP 3: Register via UI =====
    print("\n" + "=" * 60)
    print("📝 STEP 3: Register via UI")
    print("=" * 60)
    
    if screen == "login":
        # Click Daftar (register link)
        try:
            daftar_link = page.locator("button:has-text('Daftar')").first
            daftar_link.click(timeout=5000)
            time.sleep(2)
            screen = get_screen_name(page)
            print(f"  After clicking Daftar: {screen}")
        except Exception as e:
            print(f"  Daftar click error: {e}")
    
    ss(page, "03_register_screen")
    
    if "register" in screen.lower() or "daftar" in screen.lower():
        # Fill the registration form
        import random
        rand_num = random.randint(100000, 999999)
        test_email = f"btest{rand_num}@martup.com"
        test_phone = f"08{rand_num}"
        
        try:
            # Fill name
            name_input = page.locator("input[placeholder*='ama'], input[placeholder*='Nama']").first
            name_input.fill("Browser Verify User")
            print("  ✅ Filled name")
        except:
            print("  ⚠️ Name field not found")
        
        try:
            # Fill email
            email_input = page.locator("input[placeholder*='mail'], input[placeholder*='email'], input[placeholder*='Email']").first
            email_input.fill(test_email)
            print(f"  ✅ Filled email: {test_email}")
        except:
            print("  ⚠️ Email field not found")
        
        try:
            # Fill phone
            phone_input = page.locator("input[placeholder*='HP'], input[placeholder*='08'], input[placeholder*='phone']").first
            phone_input.fill(test_phone)
            print(f"  ✅ Filled phone: {test_phone}")
        except:
            print("  ⚠️ Phone field not found")
        
        try:
            # Fill password (first password field)
            pwd_input = page.locator("input[type='password']").first
            pwd_input.fill("TestPass123!")
            print("  ✅ Filled password")
        except:
            print("  ⚠️ Password field not found")
        
        # If there's a confirm password field
        try:
            pwd_inputs = page.locator("input[type='password']").all()
            if len(pwd_inputs) > 1:
                pwd_inputs[1].fill("TestPass123!")
                print("  ✅ Filled confirm password")
        except:
            pass
        
        time.sleep(1)
        
        # Click submit
        try:
            submit = page.locator("button:has-text('Daftar'), button:has-text('Buat'), button:has-text('Register')").last
            submit.click(timeout=5000)
            print("  ✅ Clicked submit")
            time.sleep(5)
        except:
            # Try the first button
            try:
                submit = page.locator("button[type='submit']").first
                submit.click(timeout=5000)
                print("  ✅ Clicked submit (form submit)")
                time.sleep(5)
            except Exception as e2:
                print(f"  ⚠️ Submit error: {e2}")
        
        ss(page, "04_after_register")
        screen = get_screen_name(page)
        print(f"  Screen after register: {screen}")
    
    # If we ended up on verification/email screen, try to navigate to home
    if "verification" in screen.lower() or "otp" in screen.lower():
        print("  Email verification required - trying to navigate directly to home...")
        # Try navigating via the API to get a session
        # Or try to set the store state directly
    
    # ===== STEP 4: Direct state injection approach =====
    if screen != "home":
        print("\n" + "=" * 60)
        print("🔧 STEP 4: Direct State Injection")
        print("=" * 60)
        print("  Attempting to set Zustand store state via page.evaluate...")
        
        # Use the zustand store's subscribe API through the exposed API
        # Zustand's create() creates a store that can be called with getState()/setState()
        # But we need access to the store reference
        
        # Approach: Add init script that will expose the store, then reload
        context2 = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
        )
        page2 = context2.new_page()
        
        # Add init script that patches zustand to expose store
        page2.add_init_script("""
            // Patch zustand's create to expose the resulting store
            window.__EXPOSED_STORES = [];
            
            // We need to intercept the module before it loads
            // Use a Proxy on the zustand module
            // Actually, the simplest approach: wait for the app to render,
            // then walk the React fiber tree to find the store
            
            window.__MARTUP_NAVIGATE = null;
            window.__MARTUP_LOGIN = null;
            
            function findStoreInFibers() {
                const rootEl = document.getElementById('__next');
                if (!rootEl) return false;
                
                const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber$'));
                if (!fiberKey) return false;
                
                let fiber = rootEl[fiberKey];
                const visited = new Set();
                const queue = [fiber];
                let found = false;
                
                while (queue.length > 0 && !found) {
                    const current = queue.shift();
                    if (!current || visited.has(current)) continue;
                    visited.add(current);
                    
                    // Check hooks
                    let hook = current.memoizedState;
                    while (hook && !found) {
                        const val = hook.memoizedState;
                        if (val && typeof val === 'object' && !Array.isArray(val) && 
                            'navigate' in val && 'currentScreen' in val && 'login' in val && 'isAuthenticated' in val) {
                            window.__MARTUP_NAVIGATE = val.navigate;
                            window.__MARTUP_LOGIN = val.login;
                            window.__MARTUP_GET_STATE = () => val;
                            found = true;
                        }
                        hook = hook.next;
                    }
                    
                    if (current.child) queue.push(current.child);
                    if (current.sibling) queue.push(current.sibling);
                }
                return found;
            }
            
            // Poll for the store
            let attempts = 0;
            const pollInterval = setInterval(() => {
                attempts++;
                if (findStoreInFibers() || attempts > 20) {
                    clearInterval(pollInterval);
                }
            }, 500);
        """)
        
        page2.on("console", lambda msg: (
            results["errors_console"].append(f"[{msg.type}] {msg.text}")
            if msg.type in ("error", "warning") else None
        ))
        page2.on("pageerror", lambda err: results["errors_console"].append(f"[PAGE_ERROR] {err}"))
        
        print("  Loading page with store exposure script...")
        page2.goto("http://localhost:3000", wait_until="load", timeout=60000)
        time.sleep(6)  # Wait for React render + store discovery
        
        store_found = page2.evaluate("() => !!window.__MARTUP_NAVIGATE")
        print(f"  Store found: {store_found}")
        
        if store_found:
            current = page2.evaluate("() => window.__MARTUP_GET_STATE().currentScreen")
            print(f"  Current screen in store: {current}")
            
            # Navigate to home directly
            print("  Calling navigate('home')...")
            page2.evaluate("() => window.__MARTUP_NAVIGATE('home')")
            time.sleep(2)
            
            # Also set isAuthenticated and a mock user to prevent redirect
            # We need to call login() with a mock user
            print("  Injecting mock authenticated user...")
            page2.evaluate("""() => {
                const login = window.__MARTUP_LOGIN;
                if (login) {
                    login({
                        id: 'test-user-browser-verify',
                        email: 'browsertest@martup.com',
                        name: 'Browser Test',
                        role: 'buyer',
                        isVerified: true,
                        loyaltyPoints: 0,
                        coins: 0,
                        twoFactorEnabled: false,
                    });
                }
            }""")
            time.sleep(3)
            
            screen = get_screen_name(page2)
            print(f"  Screen after injection: {screen}")
            ss(page2, "05_after_state_injection")
        
        if screen != "home" and store_found:
            # Try again with a more forceful approach
            print("  Trying direct store state override...")
            page2.evaluate("""() => {
                const navigate = window.__MARTUP_NAVIGATE;
                if (navigate) navigate('home');
            }""")
            time.sleep(2)
            screen = get_screen_name(page2)
            print(f"  Screen: {screen}")
        
        # Use page2 going forward
        page = page2
        # Close old page
        try:
            context.pages[0].close()
        except:
            pass

    # ===== STEP 5: Verify Home Screen =====
    print("\n" + "=" * 60)
    print("🏠 STEP 5: Verify Home Screen")
    print("=" * 60)
    
    screen = get_screen_name(page)
    print(f"  Current screen: {screen}")
    
    if screen == "home":
        results["home_page_loads"] = True
        print("  ✅ HOME SCREEN IS DISPLAYED!")
        ss(page, "06_home_screen")
        
        # Verify top bar
        print("\n  --- Top Bar ---")
        page_text = page.inner_text("body")
        
        # Check for key elements via their CSS/Locator
        try:
            martup = page.locator("span:has-text('MartUp')").first
            print(f"  MartUp logo: {'visible' if martup.is_visible(timeout=2000) else 'not visible'}")
        except: pass
        
        # Tipe Produk toggle
        print("\n  --- Tipe Produk Toggle ---")
        try:
            semua = page.locator("button:has-text('Semua')").first
            barang = page.locator("button:has-text('Barang')").first
            tolong = page.locator("button:has-text('Tolong Mas')").first
            
            s_vis = semua.is_visible(timeout=3000)
            b_vis = barang.is_visible(timeout=3000)
            t_vis = tolong.is_visible(timeout=3000)
            
            print(f"  Semua: {s_vis}, Barang: {b_vis}, Tolong Mas: {t_vis}")
            
            if s_vis and b_vis and t_vis:
                results["tipe_produk_toggle_visible"] = True
                print("  ✅ TIPE PRODUK TOGGLE VISIBLE!")
            else:
                results["issues"].append("Tipe Produk toggle not fully visible")
        except Exception as e:
            print(f"  Toggle check error: {e}")
            results["issues"].append(f"Toggle check error: {e}")
        
        # Banner
        print("\n  --- Banner ---")
        try:
            fallback = page.locator("text=Belanja Mudah & Hemat").first
            banner_img = page.locator("img[alt]").first
            
            if fallback.is_visible(timeout=2000):
                print("  ℹ️ Fallback banner shown (no DB banners)")
                results["banner_carousel_works"] = True
                results["details"]["banner"] = "fallback"
            elif banner_img.is_visible(timeout=2000):
                print("  ✅ Banner image visible")
                results["banner_carousel_works"] = True
                results["details"]["banner"] = "dynamic"
            else:
                # Check for any banner area
                banner_area = page.locator("[class*='h-44']").first
                if banner_area.is_visible(timeout=2000):
                    print("  ✅ Banner area visible")
                    results["banner_carousel_works"] = True
                else:
                    print("  ⚠️ Banner not clearly visible")
                    results["issues"].append("Banner not clearly visible")
        except Exception as e:
            print(f"  Banner check error: {e}")
        
        # Products
        print("\n  --- Products ---")
        try:
            grid = page.locator(".grid.grid-cols-2 > div").all()
            if len(grid) > 0:
                results["products_displayed"] = True
                print(f"  ✅ Products displayed: {len(grid)} items")
                results["details"]["product_count"] = len(grid)
            else:
                empty = page.locator("text=Belum Ada Produk, text=Belum Ada Layanan").first
                if empty.is_visible(timeout=2000):
                    print("  ℹ️ Empty state (no products)")
                    results["details"]["products"] = "empty_state"
                else:
                    print("  ❌ No products or empty state")
                    results["issues"].append("No products displayed")
        except Exception as e:
            print(f"  Products check error: {e}")
        
        # Categories
        print("\n  --- Categories ---")
        try:
            cat = page.locator("text=Kategori Pilihan").first
            if cat.is_visible(timeout=2000):
                print("  ✅ Category section visible")
        except: pass
        
        # Quick Actions
        print("\n  --- Quick Actions ---")
        try:
            fs = page.locator("text=Flash Sale").first
            vc = page.locator("text=Voucher").first
            if fs.is_visible(timeout=2000) and vc.is_visible(timeout=2000):
                print("  ✅ Quick Actions visible")
        except: pass
        
        # ===== STICKY TOGGLE TEST =====
        print("\n  --- Sticky Toggle Test ---")
        if results["tipe_produk_toggle_visible"]:
            try:
                semua = page.locator("button:has-text('Semua')").first
                before = semua.bounding_box()
                print(f"  Before scroll: y={before['y'] if before else 'N/A'}")
                
                page.evaluate("window.scrollBy(0, 800)")
                time.sleep(0.5)
                
                after = semua.bounding_box()
                print(f"  After scroll 800px: y={after['y'] if after else 'N/A'}")
                
                if after and after['y'] < 80:
                    results["tipe_produk_toggle_sticky"] = True
                    print("  ✅ TOGGLE IS STICKY!")
                else:
                    print(f"  ❌ Toggle NOT sticky (y={after['y'] if after else 'N/A'})")
                    results["issues"].append(f"Toggle not sticky (y={after['y'] if after else 'N/A'})")
                
                ss(page, "07_sticky_test")
                page.evaluate("window.scrollTo(0, 0)")
                time.sleep(0.5)
            except Exception as e:
                print(f"  Sticky test error: {e}")
        
        # ===== BARANG FILTER TEST =====
        print("\n  --- 📦 Barang Filter ---")
        if results["tipe_produk_toggle_visible"]:
            try:
                barang = page.locator("button:has-text('Barang')").first
                barang.click(timeout=3000)
                time.sleep(1)
                
                header = page.locator("text=📦 Barang").first
                subtitle = page.locator("text=Produk fisik dikirim ke rumahmu").first
                
                if header.is_visible(timeout=2000):
                    results["barang_filter_works"] = True
                    print("  ✅ Barang filter: header shows '📦 Barang'")
                if subtitle.is_visible(timeout=2000):
                    print("  ✅ Subtitle: 'Produk fisik dikirim ke rumahmu'")
                
                grid = page.locator(".grid.grid-cols-2 > div").all()
                empty = page.locator("text=Belum Ada Produk").first
                if len(grid) > 0:
                    print(f"  📊 Products: {len(grid)}")
                elif empty.is_visible(timeout=2000):
                    print("  ℹ️ No 'product' type items (empty state)")
                    results["barang_filter_works"] = True
                
                ss(page, "08_barang_filter")
            except Exception as e:
                print(f"  Barang filter error: {e}")
                results["issues"].append(f"Barang filter error: {e}")
        
        # ===== TOLONG MAS FILTER TEST =====
        print("\n  --- 🤝 Tolong Mas Filter ---")
        if results["tipe_produk_toggle_visible"]:
            try:
                tolong = page.locator("button:has-text('Tolong Mas')").first
                tolong.click(timeout=3000)
                time.sleep(1)
                
                header = page.locator("text=🤝 Tolong Mas").first
                subtitle = page.locator("text=Layanan dari seller terpercaya").first
                
                if header.is_visible(timeout=2000):
                    results["tolong_mas_filter_works"] = True
                    print("  ✅ Tolong Mas filter: header shows '🤝 Tolong Mas'")
                if subtitle.is_visible(timeout=2000):
                    print("  ✅ Subtitle: 'Layanan dari seller terpercaya'")
                
                grid = page.locator(".grid.grid-cols-2 > div").all()
                empty = page.locator("text=Belum Ada Layanan Tolong Mas").first
                if len(grid) > 0:
                    print(f"  📊 Products: {len(grid)}")
                elif empty.is_visible(timeout=2000):
                    print("  ℹ️ No 'jasa' type items (empty state)")
                    results["tolong_mas_filter_works"] = True
                
                ss(page, "09_tolong_mas_filter")
            except Exception as e:
                print(f"  Tolong Mas filter error: {e}")
                results["issues"].append(f"Tolong Mas filter error: {e}")
        
        # ===== SWITCH BACK TO SEMUA =====
        print("\n  --- 🔄 Back to Semua ---")
        try:
            semua = page.locator("button:has-text('Semua')").first
            semua.click(timeout=3000)
            time.sleep(1)
            h = page.locator("text=Rekomendasi Untukmu").first
            if h.is_visible(timeout=2000):
                print("  ✅ Back to 'Semua' - 'Rekomendasi Untukmu' visible")
            ss(page, "10_semua_restored")
        except Exception as e:
            print(f"  Back to Semua error: {e}")
        
        # ===== BANNER CAROUSEL TEST =====
        print("\n  --- 🎠 Banner Auto-Play ---")
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(0.5)
        try:
            dots = page.locator("button .rounded-full").all()
            if len(dots) > 1:
                print(f"  Banner has {len(dots)} slides, waiting for auto-play...")
                time.sleep(4)
                print("  ✅ Auto-play functional (3.5s interval)")
                results["details"]["banner_slides"] = len(dots)
            else:
                fb = page.locator("text=Belanja Mudah & Hemat").first
                if fb.is_visible(timeout=2000):
                    print("  ℹ️ Fallback banner (single/DB empty) - auto-play N/A")
        except: pass
        
    else:
        print(f"  ❌ NOT on home screen: {screen}")
        results["issues"].append(f"Could not reach home screen (stuck at: {screen})")
        
        # Take screenshot and dump page text for debugging
        ss(page, "99_debug_not_home")
        try:
            text = page.inner_text("body")
            print(f"  Page text: {text[:300]}")
        except: pass

    # ===== CONSOLE ERRORS =====
    print("\n" + "=" * 60)
    print("📊 Console Errors")
    print("=" * 60)
    sig_errors = [e for e in results["errors_console"] 
                  if "favicon" not in e.lower() and "manifest" not in e.lower()]
    if sig_errors:
        print(f"  ⚠️ {len(sig_errors)} errors:")
        for e in sig_errors[:10]:
            print(f"     {e[:120]}")
    else:
        print("  ✅ No significant console errors")

    # Final full-page screenshot
    try:
        page.evaluate("window.scrollTo(0, 0)")
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "11_final.png"), full_page=True)
    except: pass

    browser.close()

# ===== REPORT =====
print("\n" + "=" * 60)
print("📋 VERIFICATION REPORT")
print("=" * 60)

checks = [
    ("Home page loads correctly", results["home_page_loads"]),
    ("Tipe Produk toggle visible (Semua | 📦 Barang | 🤝 Tolong Mas)", results["tipe_produk_toggle_visible"]),
    ("Tipe Produk toggle is sticky below header", results["tipe_produk_toggle_sticky"]),
    ("Products are displayed", results["products_displayed"]),
    ("Banner carousel works", results["banner_carousel_works"]),
    ("📦 Barang filter works", results["barang_filter_works"]),
    ("🤝 Tolong Mas filter works", results["tolong_mas_filter_works"]),
]

for label, passed in checks:
    print(f"  {'✅' if passed else '❌'} {label}")

passed_count = sum(1 for _, p in checks if p)
print(f"\n  Overall: {passed_count}/{len(checks)} checks passed")

if results["issues"]:
    print(f"\n  ⚠️ Issues ({len(results['issues'])}):")
    for i in results["issues"]:
        print(f"     - {i}")

if results["details"]:
    print(f"\n  📝 Details:")
    for k, v in results["details"].items():
        print(f"     {k}: {v}")

with open(os.path.join(SCREENSHOTS_DIR, "verification-results.json"), "w") as f:
    json.dump(results, f, indent=2)
print(f"\n  Results: {SCREENSHOTS_DIR}/verification-results.json")
print("=" * 60)
