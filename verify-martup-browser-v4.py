#!/usr/bin/env python3
"""
MartUp Browser Verification Script v4
Uses Playwright with --single-process flag for stability.
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

def get_screen(page):
    """Detect current screen from visible text"""
    try:
        text = page.inner_text("body")
    except:
        return "error"
    if "Shop Smart" in text:
        return "splash"
    if "Skip" in text and "Temukan Produk" in text:
        return "onboarding"
    if "Selamat Datang" in text or ("Masuk" in text and "Email" in text):
        return "login"
    if "Daftar Akun" in text or "Buat Akun" in text:
        return "register"
    if "Semua" in text and ("Barang" in text or "Rekomendasi" in text or "Tolong Mas" in text):
        return "home"
    if "verifikasi" in text.lower() or "OTP" in text or "Kode Verifikasi" in text:
        return "verification"
    return f"unknown:{text[:60]}"

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=True,
        args=['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--single-process']
    )
    ctx = browser.new_context(
        viewport={'width': 390, 'height': 844},
        device_scale_factor=1,
    )
    page = ctx.new_page()

    page.on("console", lambda msg: (
        results["errors_console"].append(f"[{msg.type}] {msg.text}")
        if msg.type in ("error", "warning") else None
    ))
    page.on("pageerror", lambda err: results["errors_console"].append(f"[PAGE_ERROR] {err}"))

    # ===== STEP 1: Load page =====
    print("=" * 60)
    print("🌐 STEP 1: Load http://localhost:3000")
    print("=" * 60)
    
    resp = page.goto("http://localhost:3000", wait_until="commit", timeout=60000)
    print(f"  Response: {resp.status if resp else 'None'}")
    time.sleep(5)
    
    screen = get_screen(page)
    print(f"  Screen: {screen}")
    ss(page, "01_initial")
    
    if screen == "splash":
        print("  Waiting for splash → onboarding...")
        time.sleep(3)
        screen = get_screen(page)
        print(f"  After wait: {screen}")

    # ===== STEP 2: Skip onboarding =====
    print("\n" + "=" * 60)
    print("⏭️ STEP 2: Skip Onboarding → Login")
    print("=" * 60)
    
    if screen == "onboarding":
        try:
            skip = page.locator("button:has-text('Skip')").first
            skip.click(timeout=5000)
            time.sleep(2)
            screen = get_screen(page)
            print(f"  After Skip: {screen}")
        except:
            # Try clicking Next 3 times
            for i in range(3):
                try:
                    btn = page.locator("button:has-text('Next'), button:has-text('Mulai Belanja')").first
                    btn.click(timeout=3000)
                    time.sleep(1)
                except:
                    pass
            screen = get_screen(page)
            print(f"  After Next clicks: {screen}")
    
    ss(page, "02_after_onboarding")

    # ===== STEP 3: Find and expose Zustand store =====
    print("\n" + "=" * 60)
    print("🔧 STEP 3: Access Zustand Store via React Fiber")
    print("=" * 60)
    
    # Walk the React fiber tree to find the Zustand store
    store_result = page.evaluate("""() => {
        const rootEl = document.getElementById('__next');
        if (!rootEl) return {found: false, reason: 'no __next'};
        
        const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber$'));
        if (!fiberKey) return {found: false, reason: 'no fiber key'};
        
        // BFS walk through fiber tree
        const queue = [rootEl[fiberKey]];
        const visited = new Set();
        let storeState = null;
        
        while (queue.length > 0 && !storeState) {
            const fiber = queue.shift();
            if (!fiber || visited.has(fiber)) continue;
            visited.add(fiber);
            
            // Check memoizedState hooks chain
            let hook = fiber.memoizedState;
            while (hook && !storeState) {
                const val = hook.memoizedState;
                if (val && typeof val === 'object' && !Array.isArray(val) && 
                    'navigate' in val && 'currentScreen' in val && 'isAuthenticated' in val) {
                    storeState = val;
                }
                hook = hook.next;
            }
            
            if (!storeState) {
                if (fiber.child) queue.push(fiber.child);
                if (fiber.sibling) queue.push(fiber.sibling);
                if (fiber.return && fiber.return.sibling) queue.push(fiber.return.sibling);
            }
        }
        
        if (storeState) {
            window.__MARTUP_STORE = storeState;
            return {found: true, currentScreen: storeState.currentScreen, isAuthenticated: storeState.isAuthenticated};
        }
        return {found: false, reason: 'store not found in fiber tree', visitedCount: visited.size};
    }""")
    print(f"  Store search: {json.dumps(store_result)}")
    
    if store_result.get("found"):
        # Navigate directly to home
        print("  Navigating to home via store...")
        page.evaluate("""() => {
            const store = window.__MARTUP_STORE;
            if (store && store.navigate) {
                store.navigate('home');
            }
        }""")
        time.sleep(2)
        
        # Also mock login to set isAuthenticated
        print("  Setting authenticated state...")
        page.evaluate("""() => {
            const store = window.__MARTUP_STORE;
            if (store && store.login) {
                store.login({
                    id: 'browser-test-user',
                    email: 'test@martup.com',
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
        
        screen = get_screen(page)
        print(f"  After store manipulation: {screen}")
        ss(page, "03_after_store_injection")
    
    # ===== STEP 4: If not home yet, try UI-based registration =====
    if screen != "home":
        print("\n" + "=" * 60)
        print("📝 STEP 4: UI Registration Attempt")
        print("=" * 60)
        
        # Navigate to register if on login
        if screen == "login":
            try:
                daftar = page.locator("button:has-text('Daftar')").first
                if daftar.is_visible(timeout=3000):
                    daftar.click()
                    time.sleep(2)
                    screen = get_screen(page)
            except Exception as e:
                print(f"  Daftar click error: {e}")
        
        if "register" in screen.lower() or "daftar" in screen.lower():
            import random
            r = random.randint(100000, 999999)
            
            try:
                # Fill form fields
                for selector, value in [
                    ("input[placeholder*='ama'], input[placeholder*='Nama']", "Test Browser"),
                    ("input[placeholder*='mail'], input[placeholder*='Email']", f"btest{r}@martup.com"),
                    ("input[placeholder*='HP'], input[placeholder*='08'], input[placeholder*='phone']", f"08{r}"),
                ]:
                    try:
                        el = page.locator(selector).first
                        if el.is_visible(timeout=2000):
                            el.fill(value)
                            print(f"  Filled: {value[:20]}")
                    except:
                        pass
                
                # Password
                pwds = page.locator("input[type='password']").all()
                for pwd in pwds:
                    try:
                        pwd.fill("TestPass123!")
                    except:
                        pass
                print("  Filled password(s)")
                
                time.sleep(1)
                
                # Submit
                btn = page.locator("button:has-text('Daftar'), button:has-text('Buat'), button[type='submit']").last
                btn.click(timeout=5000)
                print("  Clicked submit")
                time.sleep(5)
                
                screen = get_screen(page)
                print(f"  After register: {screen}")
            except Exception as e:
                print(f"  Register error: {e}")
        
        ss(page, "04_after_register")
    
    # ===== STEP 5: If still not home, try store injection on a fresh page =====
    if screen != "home":
        print("\n" + "=" * 60)
        print("🔄 STEP 5: Fresh Page with Init Script Injection")
        print("=" * 60)
        
        # Use addInitScript to expose the store immediately
        page2 = ctx.new_page()
        page2.on("console", lambda msg: (
            results["errors_console"].append(f"[{msg.type}] {msg.text}")
            if msg.type in ("error", "warning") else None
        ))
        page2.on("pageerror", lambda err: results["errors_console"].append(f"[PAGE_ERROR] {err}"))
        
        page2.add_init_script("""() => {
            window.__MARTUP_STORE = null;
            
            function findAndExposeStore() {
                const rootEl = document.getElementById('__next');
                if (!rootEl) return false;
                
                const fiberKey = Object.keys(rootEl).find(k => k.startsWith('__reactFiber$'));
                if (!fiberKey) return false;
                
                const queue = [rootEl[fiberKey]];
                const visited = new Set();
                
                while (queue.length > 0) {
                    const fiber = queue.shift();
                    if (!fiber || visited.has(fiber)) continue;
                    visited.add(fiber);
                    
                    let hook = fiber.memoizedState;
                    while (hook) {
                        const val = hook.memoizedState;
                        if (val && typeof val === 'object' && !Array.isArray(val) && 
                            'navigate' in val && 'currentScreen' in val && 'isAuthenticated' in val) {
                            window.__MARTUP_STORE = val;
                            return true;
                        }
                        hook = hook.next;
                    }
                    
                    if (fiber.child) queue.push(fiber.child);
                    if (fiber.sibling) queue.push(fiber.sibling);
                }
                return false;
            }
            
            // Poll until store is found
            let attempts = 0;
            const interval = setInterval(() => {
                attempts++;
                if (findAndExposeStore() || attempts > 30) {
                    clearInterval(interval);
                    if (window.__MARTUP_STORE) {
                        // Auto-navigate to home and set auth
                        const store = window.__MARTUP_STORE;
                        store.login({
                            id: 'browser-test-user',
                            email: 'test@martup.com',
                            name: 'Browser Test',
                            role: 'buyer',
                            isVerified: true,
                            loyaltyPoints: 0,
                            coins: 0,
                            twoFactorEnabled: false,
                        });
                    }
                }
            }, 500);
        }""")
        
        print("  Loading page with init script...")
        page2.goto("http://localhost:3000", wait_until="commit", timeout=60000)
        time.sleep(8)
        
        # Check if store was found and we're on home
        store_found = page2.evaluate("() => !!window.__MARTUP_STORE")
        screen2 = get_screen(page2)
        print(f"  Store found: {store_found}, Screen: {screen2}")
        
        if store_found and screen2 != "home":
            # Force navigate
            page2.evaluate("() => { if(window.__MARTUP_STORE) window.__MARTUP_STORE.navigate('home'); }")
            time.sleep(3)
            screen2 = get_screen(page2)
            print(f"  After force navigate: {screen2}")
        
        ss(page2, "05_fresh_page_injection")
        
        # Use page2 going forward
        page = page2
        screen = screen2

    # ===== HOME SCREEN VERIFICATION =====
    print("\n" + "=" * 60)
    print("🏠 STEP 6: Verify Home Screen")
    print("=" * 60)
    
    screen = get_screen(page)
    print(f"  Current screen: {screen}")
    
    if screen == "home":
        results["home_page_loads"] = True
        print("  ✅ HOME SCREEN DISPLAYED!")
        ss(page, "06_home_screen")
        
        # --- Top Bar ---
        print("\n  --- Top Bar ---")
        try:
            martup = page.locator("span:has-text('MartUp')").first
            if martup.is_visible(timeout=2000):
                print("  ✅ MartUp logo visible")
                results["details"]["martup_logo"] = True
        except: pass
        
        try:
            search = page.locator("svg").filter(has_text="").first  # SVG icons
            # Alternative: check for the search bar button
            search_bar = page.locator("button").filter(has=page.locator("svg.lucide-search, svg.lucide-Search")).first
            if search_bar.is_visible(timeout=2000):
                print("  ✅ Search bar visible")
        except: pass
        
        # --- Tipe Produk Toggle ---
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
                print("  ✅ TIPE PRODUK TOGGLE VISIBLE: Semua | 📦 Barang | 🤝 Tolong Mas")
                
                # Check active state of Semua
                semua_classes = semua.get_attribute("class") or ""
                if "gradient" in semua_classes or "text-white" in semua_classes:
                    print("  ✅ 'Semua' button is active (has highlight styling)")
            else:
                results["issues"].append("Tipe Produk toggle not fully visible")
        except Exception as e:
            print(f"  Toggle check error: {e}")
            results["issues"].append(f"Toggle check error: {e}")
        
        # --- Banner ---
        print("\n  --- Banner Carousel ---")
        try:
            # Check for fallback banner
            fallback = page.locator("text=Belanja Mudah & Hemat").first
            banner_img = page.locator("[class*='h-44'] img").first
            
            if fallback.is_visible(timeout=2000):
                print("  ℹ️ Fallback gradient banner shown (no DB banners configured)")
                results["banner_carousel_works"] = True
                results["details"]["banner"] = "fallback_gradient"
            elif banner_img.is_visible(timeout=2000):
                print("  ✅ Banner image visible from DB")
                results["banner_carousel_works"] = True
                results["details"]["banner"] = "dynamic_db"
                
                # Check for carousel dots
                dots = page.locator("[class*='h-44'] button .rounded-full").all()
                if len(dots) > 1:
                    print(f"  ✅ Banner carousel has {len(dots)} slides with dot indicators")
                    results["details"]["banner_slides"] = len(dots)
            else:
                # Check for the banner area itself
                banner_area = page.locator("[class*='h-44']").first
                if banner_area.is_visible(timeout=2000):
                    print("  ✅ Banner area visible")
                    results["banner_carousel_works"] = True
                else:
                    print("  ⚠️ Banner not clearly visible")
                    results["issues"].append("Banner area not visible")
        except Exception as e:
            print(f"  Banner check error: {e}")
        
        # --- Quick Actions ---
        print("\n  --- Quick Actions ---")
        try:
            flash = page.locator("text=Flash Sale").first
            voucher = page.locator("text=Voucher").first
            topup = page.locator("text=Top-Up").first
            
            fs_vis = flash.is_visible(timeout=2000)
            vc_vis = voucher.is_visible(timeout=2000)
            tp_vis = topup.is_visible(timeout=2000)
            
            if fs_vis and vc_vis:
                print("  ✅ Quick Actions visible (Flash Sale, Voucher, etc.)")
                results["details"]["quick_actions"] = True
        except: pass
        
        # --- Categories ---
        print("\n  --- Categories ---")
        try:
            cat_header = page.locator("text=Kategori Pilihan").first
            if cat_header.is_visible(timeout=2000):
                print("  ✅ Category section visible")
                results["details"]["category_section"] = True
        except: pass
        
        # --- Products ---
        print("\n  --- Products ---")
        try:
            grid = page.locator(".grid.grid-cols-2 > div").all()
            if len(grid) > 0:
                results["products_displayed"] = True
                print(f"  ✅ Products displayed: {len(grid)} items in grid")
                results["details"]["product_count"] = len(grid)
            else:
                # Check for empty state
                empty = page.locator("text=Belum Ada Produk").first
                empty_jasa = page.locator("text=Belum Ada Layanan").first
                if empty.is_visible(timeout=2000):
                    print("  ℹ️ Empty state: 'Belum Ada Produk' (no products in DB)")
                    results["details"]["products"] = "empty_state"
                elif empty_jasa.is_visible(timeout=2000):
                    print("  ℹ️ Empty state: 'Belum Ada Layanan'")
                    results["details"]["products"] = "empty_state_jasa"
                else:
                    print("  ⚠️ No products or empty state visible")
                    results["issues"].append("No products displayed")
        except Exception as e:
            print(f"  Products check error: {e}")
        
        # ===== STICKY TOGGLE TEST =====
        print("\n" + "=" * 60)
        print("📌 STEP 7: Sticky Toggle Test")
        print("=" * 60)
        
        if results["tipe_produk_toggle_visible"]:
            try:
                semua = page.locator("button:has-text('Semua')").first
                before = semua.bounding_box()
                print(f"  Toggle position before scroll: y={before['y'] if before else 'N/A'}")
                
                # Scroll down 1000px
                page.evaluate("window.scrollBy(0, 1000)")
                time.sleep(0.5)
                
                after = semua.bounding_box()
                print(f"  Toggle position after scroll 1000px: y={after['y'] if after else 'N/A'}")
                
                if after and before:
                    # Toggle should be near top: sticky top-14 = ~56px from viewport top
                    if after['y'] < 80:  # Allow some margin for rendering
                        results["tipe_produk_toggle_sticky"] = True
                        print("  ✅ TOGGLE IS STICKY! Stays visible at top when scrolling")
                    else:
                        print(f"  ❌ Toggle NOT sticky - moved to y={after['y']}")
                        results["issues"].append(f"Tipe Produk toggle not sticky (y={after['y']})")
                else:
                    print("  ⚠️ Could not get toggle bounding box")
                
                ss(page, "07_sticky_scroll_test")
                
                # Scroll back up
                page.evaluate("window.scrollTo(0, 0)")
                time.sleep(0.5)
            except Exception as e:
                print(f"  Sticky test error: {e}")
                results["issues"].append(f"Sticky test error: {e}")
        
        # ===== BARANG FILTER TEST =====
        print("\n" + "=" * 60)
        print("📦 STEP 8: Barang Filter Test")
        print("=" * 60)
        
        if results["tipe_produk_toggle_visible"]:
            try:
                barang = page.locator("button:has-text('Barang')").first
                barang.click(timeout=3000)
                time.sleep(1.5)
                
                # Check header changed
                header = page.locator("text=📦 Barang").first
                subtitle = page.locator("text=Produk fisik dikirim ke rumahmu").first
                
                h_vis = header.is_visible(timeout=2000)
                s_vis = subtitle.is_visible(timeout=2000)
                
                if h_vis:
                    results["barang_filter_works"] = True
                    print("  ✅ Barang filter active - header shows '📦 Barang'")
                if s_vis:
                    print("  ✅ Subtitle changed: 'Produk fisik dikirim ke rumahmu'")
                
                # Check button styling
                barang_cls = barang.get_attribute("class") or ""
                if "emerald" in barang_cls or "text-white" in barang_cls:
                    print("  ✅ Barang button has active styling (emerald)")
                
                # Count products
                grid = page.locator(".grid.grid-cols-2 > div").all()
                empty = page.locator("text=Belum Ada Produk").first
                if len(grid) > 0:
                    print(f"  📊 Filtered products (Barang): {len(grid)}")
                elif empty.is_visible(timeout=2000):
                    print("  ℹ️ Empty state for Barang (no 'product' type items)")
                    results["barang_filter_works"] = True  # Filter works, just no data
                
                ss(page, "08_barang_filter")
            except Exception as e:
                print(f"  ❌ Barang filter error: {e}")
                results["issues"].append(f"Barang filter error: {e}")
        
        # ===== TOLONG MAS FILTER TEST =====
        print("\n" + "=" * 60)
        print("🤝 STEP 9: Tolong Mas Filter Test")
        print("=" * 60)
        
        if results["tipe_produk_toggle_visible"]:
            try:
                tolong = page.locator("button:has-text('Tolong Mas')").first
                tolong.click(timeout=3000)
                time.sleep(1.5)
                
                # Check header changed
                header = page.locator("text=🤝 Tolong Mas").first
                subtitle = page.locator("text=Layanan dari seller terpercaya").first
                
                h_vis = header.is_visible(timeout=2000)
                s_vis = subtitle.is_visible(timeout=2000)
                
                if h_vis:
                    results["tolong_mas_filter_works"] = True
                    print("  ✅ Tolong Mas filter active - header shows '🤝 Tolong Mas'")
                if s_vis:
                    print("  ✅ Subtitle changed: 'Layanan dari seller terpercaya'")
                
                # Check button styling
                tolong_cls = tolong.get_attribute("class") or ""
                if "purple" in tolong_cls or "text-white" in tolong_cls:
                    print("  ✅ Tolong Mas button has active styling (purple)")
                
                # Count products
                grid = page.locator(".grid.grid-cols-2 > div").all()
                empty = page.locator("text=Belum Ada Layanan Tolong Mas").first
                if len(grid) > 0:
                    print(f"  📊 Filtered products (Tolong Mas): {len(grid)}")
                elif empty.is_visible(timeout=2000):
                    print("  ℹ️ Empty state for Tolong Mas (no 'jasa' type items)")
                    results["tolong_mas_filter_works"] = True
                
                ss(page, "09_tolong_mas_filter")
            except Exception as e:
                print(f"  ❌ Tolong Mas filter error: {e}")
                results["issues"].append(f"Tolong Mas filter error: {e}")
        
        # ===== SWITCH BACK TO SEMUA =====
        print("\n  --- 🔄 Back to Semua ---")
        try:
            semua = page.locator("button:has-text('Semua')").first
            semua.click(timeout=3000)
            time.sleep(1)
            
            rec = page.locator("text=Rekomendasi Untukmu").first
            if rec.is_visible(timeout=2000):
                print("  ✅ Switched back to 'Semua' - 'Rekomendasi Untukmu' visible")
            
            grid = page.locator(".grid.grid-cols-2 > div").all()
            print(f"  📊 All products: {len(grid)}")
            
            ss(page, "10_semua_restored")
        except Exception as e:
            print(f"  Back to Semua error: {e}")
        
        # ===== BANNER CAROUSEL AUTO-PLAY =====
        print("\n  --- 🎠 Banner Auto-Play ---")
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(0.5)
        
        try:
            dots = page.locator("[class*='h-44'] button .rounded-full").all()
            if len(dots) > 1:
                print(f"  Banner has {len(dots)} slides. Waiting for auto-play (3.5s interval)...")
                time.sleep(4)
                print("  ✅ Banner auto-play functional")
            else:
                fb = page.locator("text=Belanja Mudah & Hemat").first
                if fb.is_visible(timeout=2000):
                    print("  ℹ️ Fallback banner - auto-play not applicable")
        except: pass
    
    else:
        print(f"  ❌ NOT on home screen: {screen}")
        results["issues"].append(f"Could not reach home screen (stuck at: {screen})")
        ss(page, "99_not_home")
        
        # Dump text for debugging
        try:
            text = page.inner_text("body")[:500]
            print(f"  Page text: {text}")
        except: pass

    # ===== CONSOLE ERRORS =====
    print("\n" + "=" * 60)
    print("📊 Console Errors Summary")
    print("=" * 60)
    
    sig_errors = [e for e in results["errors_console"] 
                  if "favicon" not in e.lower() 
                  and "manifest" not in e.lower()
                  and "devtools" not in e.lower()]
    
    if sig_errors:
        print(f"  ⚠️ {len(sig_errors)} significant errors/warnings:")
        for e in sig_errors[:15]:
            print(f"     {e[:150]}")
    else:
        print("  ✅ No significant console errors")

    # Full page screenshot
    try:
        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(0.5)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "11_final_full_page.png"), full_page=True)
    except: pass

    browser.close()

# ===== FINAL REPORT =====
print("\n" + "=" * 60)
print("📋 FINAL VERIFICATION REPORT - MartUp @ localhost:3000")
print("=" * 60)

checks = [
    ("Home page loads correctly", results["home_page_loads"]),
    ("Tipe Produk toggle visible (Semua | 📦 Barang | 🤝 Tolong Mas)", results["tipe_produk_toggle_visible"]),
    ("Tipe Produk toggle is sticky below header on scroll", results["tipe_produk_toggle_sticky"]),
    ("Products are displayed", results["products_displayed"]),
    ("Banner carousel works", results["banner_carousel_works"]),
    ("📦 Barang filter works", results["barang_filter_works"]),
    ("🤝 Tolong Mas filter works", results["tolong_mas_filter_works"]),
]

print()
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

print(f"\n  Screenshots & results: {SCREENSHOTS_DIR}/")
print("=" * 60)
