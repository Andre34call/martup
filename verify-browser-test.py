#!/usr/bin/env python3
"""Browser verification of MartUp e-commerce app at http://localhost:3000"""

import json
import subprocess
import sys
import time
import os
import signal
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:3000"
results = {}

def log(section, message, status="info"):
    icon = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️", "ERROR": "🔴", "INFO": "ℹ️"}.get(status.upper(), "ℹ️")
    print(f"  {icon} {section}: {message}")

# Start the dev server
print("Starting dev server...")
server_proc = subprocess.Popen(
    ["node", "node_modules/.bin/next", "dev", "-p", "3000", "-H", "0.0.0.0"],
    cwd="/home/z/my-project",
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    env={**os.environ, "NODE_OPTIONS": "--max-old-space-size=768"},
)

# Wait for server to be ready
import urllib.request
import urllib.error

for attempt in range(30):
    time.sleep(2)
    try:
        req = urllib.request.urlopen(f"{BASE_URL}/api/ping", timeout=5)
        if req.status == 200:
            print(f"Server ready after {(attempt+1)*2}s!")
            break
    except Exception:
        if attempt % 5 == 0:
            print(f"  Waiting for server... ({(attempt+1)*2}s)")
        # Check if process is still alive
        if server_proc.poll() is not None:
            print(f"  Server process died with code {server_proc.returncode}")
            out = server_proc.stdout.read().decode()[-500:] if server_proc.stdout else ""
            print(f"  Output: {out}")
            break
else:
    print("Server didn't respond in 60s, trying anyway...")

# Give it a bit more time for compilation
time.sleep(3)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-gpu"])
        context = browser.new_context(
            viewport={"width": 390, "height": 844},  # Mobile-first app
            ignore_https_errors=True,
        )
        
        # Collect console messages
        console_errors = []
        console_warnings = []
        failed_requests = []
        all_console = []
        
        page = context.new_page()
        
        # Listen to console
        def on_console(msg):
            entry = f"[{msg.type}] {msg.text[:300]}"
            all_console.append(entry)
            if msg.type == "error":
                console_errors.append(entry)
            elif msg.type == "warning":
                console_warnings.append(entry)
        
        page.on("console", on_console)
        page.on("requestfailed", lambda req: failed_requests.append(f"{req.method} {req.url} -> {req.failure}"))
        
        # ===================================================================
        # TEST 1: App Loads - Homepage renders
        # ===================================================================
        print("\n" + "="*60)
        print("TEST 1: App Loads - Homepage Renders")
        print("="*60)
        
        try:
            page.goto(BASE_URL, wait_until="networkidle", timeout=90000)
            time.sleep(5)  # Let React hydration and animations finish
            
            title = page.title()
            log("Title", title, "info")
            
            # Check if page is blank white screen
            body_text = page.inner_text("body")
            log("Body text length", f"{len(body_text)} chars", "info")
            log("Body text preview", body_text[:300], "info")
            
            # Check for MartUp branding
            page_html = page.content()
            has_martup = "MartUp" in body_text or "martup" in page_html.lower()
            log("MartUp branding", "Found" if has_martup else "NOT FOUND", "PASS" if has_martup else "FAIL")
            
            # Check for splash screen elements
            has_splash = "Shop Smart" in body_text or "Live Better" in body_text
            log("Splash screen", "Visible" if has_splash else "Not visible/passed", "info")
            
            # Check for loading spinner
            has_loading = "Memuat" in body_text
            log("Loading spinner", "Still showing" if has_loading else "Resolved", "WARN" if has_loading else "info")
            
            # Check background
            bg_color = page.evaluate("() => getComputedStyle(document.body).backgroundColor")
            is_blank_white = bg_color in ("rgb(255, 255, 255)", "rgba(0, 0, 0, 0)") and len(body_text.strip()) < 10
            log("Blank white screen", "YES - PROBLEM!" if is_blank_white else "No", "FAIL" if is_blank_white else "PASS")
            
            # Check for app container
            has_app_container = "app-container" in page_html
            log("App container", "Found" if has_app_container else "NOT FOUND", "PASS" if has_app_container else "FAIL")
            
            # Check for bottom nav (may need to wait for auth state)
            has_bottom_nav = "bottom" in page_html.lower() and ("nav" in page_html.lower() or "tab" in page_html.lower())
            
            # Screenshot
            page.screenshot(path="/home/z/my-project/verify-screenshot-browser-home.png", full_page=True)
            log("Screenshot", "Saved", "info")
            
            results["app_loads"] = {
                "status": "PASS" if (has_martup or has_app_container) and not is_blank_white else "FAIL",
                "title": title,
                "body_text_length": len(body_text),
                "has_martup_branding": has_martup,
                "has_app_container": has_app_container,
                "has_splash_screen": has_splash,
                "bg_color": bg_color,
                "is_blank_white_screen": is_blank_white,
                "has_loading_spinner": has_loading,
            }
        except Exception as e:
            log("Error loading page", str(e)[:300], "FAIL")
            results["app_loads"] = {"status": "FAIL", "error": str(e)}
        
        # ===================================================================
        # TEST 2: Console Errors
        # ===================================================================
        print("\n" + "="*60)
        print("TEST 2: Console Errors / Failed API Calls")
        print("="*60)
        
        # Give extra time for async API calls
        time.sleep(3)
        
        log("Console errors", f"{len(console_errors)} found", "WARN" if console_errors else "PASS")
        for err in console_errors[:15]:
            log("  Error", err[:200], "ERROR")
        
        log("Console warnings", f"{len(console_warnings)} found", "info")
        for warn in console_warnings[:10]:
            log("  Warning", warn[:200], "WARN")
        
        log("Failed network requests", f"{len(failed_requests)} found", "FAIL" if failed_requests else "PASS")
        for req in failed_requests[:10]:
            log("  Failed", req[:200], "ERROR")
        
        # Categorize errors
        api_errors = [e for e in console_errors if "/api/" in e]
        db_errors = [e for e in console_errors if "prisma" in e.lower() or "database" in e.lower() or "postgresql" in e.lower()]
        auth_errors = [e for e in console_errors if "auth" in e.lower() or "401" in e or "403" in e]
        network_errors = [e for e in console_errors if "fetch" in e.lower() or "network" in e.lower() or "ERR_" in e]
        
        log("API-related errors", f"{len(api_errors)}", "info")
        log("Database errors", f"{len(db_errors)}", "info")
        log("Auth errors", f"{len(auth_errors)}", "info")
        log("Network errors", f"{len(network_errors)}", "info")
        
        results["console_errors"] = {
            "status": "PASS" if not console_errors and not failed_requests else "WARN",
            "error_count": len(console_errors),
            "warning_count": len(console_warnings),
            "failed_request_count": len(failed_requests),
            "api_error_count": len(api_errors),
            "db_error_count": len(db_errors),
            "auth_error_count": len(auth_errors),
            "errors": console_errors[:30],
            "failed_requests": failed_requests[:10],
            "all_console": all_console[:50],
        }
        
        # ===================================================================
        # TEST 3: Footer / Bottom Nav Sticky Check
        # ===================================================================
        print("\n" + "="*60)
        print("TEST 3: Footer / Bottom Nav Sticky Check")
        print("="*60)
        
        try:
            # Check for fixed/sticky bottom navigation
            sticky_info = page.evaluate("""() => {
                const results = {
                    stickyElements: [],
                    bottomNavElements: [],
                    layoutInfo: null,
                    viewportHeight: window.innerHeight,
                    documentHeight: document.documentElement.scrollHeight,
                };
                
                // Find all sticky/fixed elements
                const allElements = document.querySelectorAll('*');
                for (const el of allElements) {
                    const style = getComputedStyle(el);
                    if (style.position === 'sticky' || style.position === 'fixed') {
                        results.stickyElements.push({
                            tag: el.tagName,
                            classes: el.className.toString().substring(0, 120),
                            position: style.position,
                            bottom: style.bottom,
                            top: style.top,
                        });
                    }
                }
                
                // Check app container layout
                const container = document.querySelector('.app-container');
                if (container) {
                    const style = getComputedStyle(container);
                    results.layoutInfo = {
                        display: style.display,
                        flexDirection: style.flexDirection,
                        minHeight: style.minHeight,
                        height: container.offsetHeight,
                    };
                    
                    // Check children
                    results.containerChildren = Array.from(container.children).map(c => ({
                        tag: c.tagName,
                        classes: c.className.toString().substring(0, 100),
                        height: c.offsetHeight,
                        display: getComputedStyle(c).display,
                        flex: getComputedStyle(c).flex,
                    }));
                }
                
                // Find bottom nav specifically
                const navs = document.querySelectorAll('nav, [class*="bottom"], [class*="Bottom"], [class*="tab-bar"], [class*="TabBar"]');
                for (const nav of navs) {
                    const style = getComputedStyle(nav);
                    results.bottomNavElements.push({
                        tag: nav.tagName,
                        classes: nav.className.toString().substring(0, 120),
                        position: style.position,
                        bottom: style.bottom,
                        height: nav.offsetHeight,
                        isInViewport: nav.getBoundingClientRect().bottom <= window.innerHeight,
                    });
                }
                
                return results;
            }""")
            
            log("Viewport height", f"{sticky_info['viewportHeight']}px", "info")
            log("Document height", f"{sticky_info['documentHeight']}px", "info")
            log("Sticky/fixed elements", f"{len(sticky_info['stickyElements'])} found", "info")
            for el in sticky_info['stickyElements']:
                log("  Sticky", f"{el['tag']}.{el['classes'][:60]} pos={el['position']} top={el['top']} bottom={el['bottom']}", "info")
            
            log("Bottom nav elements", f"{len(sticky_info['bottomNavElements'])} found", "info")
            for el in sticky_info['bottomNavElements']:
                log("  Nav", f"{el['tag']}.{el['classes'][:60]} pos={el['position']} bottom={el['bottom']} h={el['height']}px", "info")
            
            if sticky_info.get('layoutInfo'):
                log("Layout info", json.dumps(sticky_info['layoutInfo']), "info")
            if sticky_info.get('containerChildren'):
                for child in sticky_info['containerChildren']:
                    log("  Child", f"{child['tag']}.{child['classes'][:60]} h={child['height']}px flex={child['flex']}", "info")
            
            # Determine if footer sticks
            has_sticky_bottom = any(
                el.get('position') in ('fixed', 'sticky') and (el.get('bottom') not in ('auto', '0px', '') or 'bottom' in el.get('classes', '').lower())
                for el in sticky_info['stickyElements']
            )
            has_fixed_bottom_nav = any(
                el.get('position') == 'fixed' and 'bottom' in el.get('classes', '').lower()
                for el in sticky_info['bottomNavElements']
            )
            has_flex_min_height = sticky_info.get('layoutInfo', {}).get('minHeight', '') != '0px' and sticky_info.get('layoutInfo', {}).get('minHeight', '') != 'auto'
            
            footer_sticky = has_sticky_bottom or has_fixed_bottom_nav or has_flex_min_height
            log("Footer sticky assessment", 
                f"sticky_bottom={has_sticky_bottom}, fixed_nav={has_fixed_bottom_nav}, flex_min_h={has_flex_min_height}",
                "PASS" if footer_sticky else "WARN")
            
            results["footer_sticky"] = {
                "status": "PASS" if footer_sticky else "WARN",
                "has_sticky_bottom_elements": has_sticky_bottom,
                "has_fixed_bottom_nav": has_fixed_bottom_nav,
                "has_flex_min_height": has_flex_min_height,
                "sticky_elements": sticky_info['stickyElements'],
                "bottom_nav_elements": sticky_info['bottomNavElements'],
                "layout_info": sticky_info.get('layoutInfo'),
                "container_children": sticky_info.get('containerChildren', []),
            }
        except Exception as e:
            log("Error", str(e)[:300], "FAIL")
            results["footer_sticky"] = {"status": "FAIL", "error": str(e)}
        
        # ===================================================================
        # TEST 4: Basic Navigation
        # ===================================================================
        print("\n" + "="*60)
        print("TEST 4: Basic Navigation")
        print("="*60)
        
        nav_results = {}
        
        # 4a: Find and click login button
        try:
            console_errors.clear()
            failed_requests.clear()
            
            # Look for login/sign-in elements
            login_selectors = [
                "text=Masuk", "text=Login", "text=Sign In", "text=Sign in",
                "button:has-text('Masuk')", "a:has-text('Masuk')",
                "button:has-text('Login')", "a:has-text('Login')",
                "[data-testid='login']", "[data-testid='masuk']",
            ]
            
            login_element = None
            for selector in login_selectors:
                try:
                    el = page.query_selector(selector)
                    if el and el.is_visible():
                        login_element = el
                        log("Login element found", f"via selector: {selector}", "PASS")
                        break
                except:
                    continue
            
            if not login_element:
                # Check what interactive elements are on the page
                interactive = page.evaluate("""() => {
                    const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
                    return buttons.slice(0, 20).map(b => ({
                        tag: b.tagName,
                        text: b.textContent?.trim().substring(0, 50) || '',
                        classes: b.className.toString().substring(0, 80),
                        href: b.href || '',
                    }));
                }""")
                log("Interactive elements on page", f"{len(interactive)} found", "info")
                for el in interactive:
                    log("  Element", f"{el['tag']} text='{el['text'][:40]}' classes='{el['classes'][:50]}'", "info")
                
                nav_results["login_click"] = "SKIP - no login button visible"
            else:
                login_element.click()
                time.sleep(3)
                
                # Take screenshot
                page.screenshot(path="/home/z/my-project/verify-screenshot-browser-login.png", full_page=True)
                
                # Check if login screen appeared
                current_text = page.inner_text("body")
                login_keywords = ["email", "password", "masuk", "login", "sign in", "kata sandi", "alamat email"]
                is_login_screen = any(kw in current_text.lower() for kw in login_keywords)
                log("Login screen", "Appeared" if is_login_screen else "Not detected", "PASS" if is_login_screen else "WARN")
                log("Screen content preview", current_text[:200], "info")
                
                nav_results["login_click"] = "PASS" if is_login_screen else "WARN"
        except Exception as e:
            log("Login nav error", str(e)[:200], "ERROR")
            nav_results["login_click"] = f"ERROR: {e}"
        
        # 4b: Try navigating back and browsing
        try:
            page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
            time.sleep(3)
            
            # Look for category or product browsing
            browse_selectors = [
                "text=Kategori", "text=Category", "text=Jelajahi", "text=Browse",
                "text=Produk", "text=Products", "text=Belanja", "text=Shop",
                "[placeholder*='Cari']", "[placeholder*='Search']",
            ]
            
            browse_found = False
            for selector in browse_selectors:
                try:
                    el = page.query_selector(selector)
                    if el and el.is_visible():
                        log("Browse element found", f"via: {selector}", "PASS")
                        browse_found = True
                        break
                except:
                    continue
            
            nav_results["browse"] = "PASS" if browse_found else "WARN - no browse elements visible"
        except Exception as e:
            nav_results["browse"] = f"ERROR: {e}"
        
        # 4c: Try bottom navigation tabs
        try:
            # Find and click bottom nav tabs
            bottom_nav_info = page.evaluate("""() => {
                // Find the bottom navigation
                const navs = document.querySelectorAll('nav, [class*="Bottom"], [class*="bottom"]');
                const results = [];
                for (const nav of navs) {
                    const rect = nav.getBoundingClientRect();
                    if (rect.bottom > window.innerHeight * 0.7) {  // Bottom 30% of viewport
                        const buttons = nav.querySelectorAll('button, a, [role="button"], [role="tab"]');
                        for (const btn of buttons) {
                            results.push({
                                text: btn.textContent?.trim().substring(0, 50) || '',
                                classes: btn.className.toString().substring(0, 80),
                                tag: btn.tagName,
                                href: btn.href || '',
                            });
                        }
                    }
                }
                return results;
            }""")
            
            log("Bottom nav tabs", f"{len(bottom_nav_info)} found", "info")
            for tab in bottom_nav_info:
                log("  Tab", f"'{tab['text'][:30]}' ({tab['tag']})", "info")
            
            # Try clicking bottom tabs
            tabs_clicked = 0
            for i, tab_info in enumerate(bottom_nav_info[:5]):
                try:
                    # Re-find the element (stale references)
                    bottom_navs = page.evaluate_handle("""() => {
                        const navs = document.querySelectorAll('nav, [class*="Bottom"], [class*="bottom"]');
                        for (const nav of navs) {
                            const rect = nav.getBoundingClientRect();
                            if (rect.bottom > window.innerHeight * 0.7) {
                                return Array.from(nav.querySelectorAll('button, a'));
                            }
                        }
                        return [];
                    }""").json_value()
                    
                    # Click by index
                    page.evaluate(f"""() => {{
                        const navs = document.querySelectorAll('nav, [class*="Bottom"], [class*="bottom"]');
                        for (const nav of navs) {{
                            const rect = nav.getBoundingClientRect();
                            if (rect.bottom > window.innerHeight * 0.7) {{
                                const buttons = nav.querySelectorAll('button, a');
                                if (buttons[{i}]) buttons[{i}].click();
                            }}
                        }}
                    }}""")
                    time.sleep(1)
                    tabs_clicked += 1
                    screen_text = page.inner_text("body")[:150]
                    log(f"Tab '{tab_info['text'][:20]}'", f"Clicked -> {screen_text[:80]}...", "info")
                except Exception as e:
                    log(f"Tab click error", str(e)[:100], "ERROR")
            
            nav_results["bottom_tabs"] = f"PASS - clicked {tabs_clicked} tabs" if tabs_clicked > 0 else "WARN - no tabs found/clicked"
        except Exception as e:
            nav_results["bottom_tabs"] = f"ERROR: {e}"
        
        # 4d: Test direct API calls
        try:
            api_test_results = {}
            
            # Test various API endpoints
            endpoints = [
                ("/api/ping", "Ping"),
                ("/api/health", "Health"),
                ("/api/csrf-token", "CSRF Token"),
                ("/api/categories", "Categories"),
                ("/api/products", "Products"),
                ("/api/banners", "Banners"),
                ("/api/auth/me", "Auth Me"),
            ]
            
            for path, name in endpoints:
                try:
                    resp = page.evaluate(f"""async () => {{
                        try {{
                            const r = await fetch('{path}');
                            const text = await r.text();
                            return {{ status: r.status, body: text.substring(0, 200) }};
                        }} catch(e) {{
                            return {{ status: 0, body: e.message }};
                        }}
                    }}""")
                    status = resp.get("status", 0)
                    body = resp.get("body", "")[:150]
                    is_ok = 200 <= status < 300
                    log(f"API {name}", f"HTTP {status} -> {body[:100]}", "PASS" if is_ok else "WARN")
                    api_test_results[name] = {"status": status, "body": body, "ok": is_ok}
                except Exception as e:
                    log(f"API {name}", f"Error: {str(e)[:100]}", "ERROR")
                    api_test_results[name] = {"error": str(e)}
            
            nav_results["api_endpoints"] = api_test_results
        except Exception as e:
            nav_results["api_endpoints"] = f"ERROR: {e}"
        
        results["navigation"] = nav_results
        
        # Final screenshots
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        time.sleep(2)
        page.screenshot(path="/home/z/my-project/verify-screenshot-browser-final.png", full_page=True)
        
        # Also take desktop screenshot
        page.set_viewport_size({"width": 1280, "height": 800})
        page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
        time.sleep(2)
        page.screenshot(path="/home/z/my-project/verify-screenshot-browser-desktop.png", full_page=True)
        
        browser.close()

finally:
    # Kill the server
    print("\nShutting down dev server...")
    server_proc.terminate()
    try:
        server_proc.wait(timeout=5)
    except:
        server_proc.kill()

# ===================================================================
# SUMMARY
# ===================================================================
print("\n" + "="*60)
print("VERIFICATION SUMMARY")
print("="*60)

overall_status = "PASS"
for key, val in results.items():
    status = val.get("status", "UNKNOWN") if isinstance(val, dict) else "UNKNOWN"
    icon = {"PASS": "✅", "FAIL": "❌", "WARN": "⚠️"}.get(status, "❓")
    print(f"  {icon} {key}: {status}")
    if status == "FAIL":
        overall_status = "FAIL"
    elif status == "WARN" and overall_status != "FAIL":
        overall_status = "WARN"

print(f"\n  Overall: {overall_status}")

# Save results
with open("/home/z/my-project/verify-browser-results.json", "w") as f:
    json.dump(results, f, indent=2, default=str)

print(f"Detailed results saved to verify-browser-results.json")
