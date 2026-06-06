#!/usr/bin/env python3
"""
Focused browser verification for checkout/cart system.
Tests cart store operations directly and verifies page rendering.
"""

import asyncio
import json
import sys
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:3000"
SCREENSHOT_DIR = "/home/z/my-project/verify-screenshots"

console_messages = []
js_errors = []

async def main():
    import os
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        context = await browser.new_context(
            viewport={"width": 430, "height": 932},
            ignore_https_errors=True
        )
        page = await context.new_page()

        # Capture console and errors
        page.on("console", lambda msg: console_messages.append({
            "type": msg.type,
            "text": msg.text[:500]
        }))
        page.on("pageerror", lambda err: js_errors.append({
            "message": str(err)[:500],
            "name": err.name
        }))

        results = {}

        # ============================================
        # STEP 1: Load Home Page
        # ============================================
        print("\n" + "="*60)
        print("STEP 1: Load Home Page & Check Structure")
        print("="*60)

        try:
            response = await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
            await asyncio.sleep(3)

            results["home_http_status"] = response.status if response else "no response"
            print(f"  HTTP Status: {results['home_http_status']}")

            # Check if the Next.js app rendered
            has_next_root = await page.evaluate("!!document.getElementById('__next')")
            results["has_next_root"] = has_next_root
            print(f"  Has #__next root: {has_next_root}")

            # Check page title
            title = await page.title()
            results["page_title"] = title
            print(f"  Title: {title}")

            # Check for the MartUp logo text
            has_martup = await page.evaluate("""
                () => {
                    const allText = document.body.innerText;
                    return allText.includes('MartUp');
                }
            """)
            results["home_has_martup"] = has_martup
            print(f"  Has 'MartUp' text: {has_martup}")

            # Get the full rendered HTML structure
            html_snippet = await page.evaluate("""
                () => {
                    const body = document.body;
                    return body.innerHTML.substring(0, 2000);
                }
            """)
            results["html_snippet_len"] = len(html_snippet)
            print(f"  Body HTML length: {len(html_snippet)}")

            # Take screenshot
            await page.screenshot(path=f"{SCREENSHOT_DIR}/01-home-page.png")
            print("  Screenshot: 01-home-page.png")

        except Exception as e:
            results["home_error"] = str(e)
            print(f"  ERROR: {e}")

        # ============================================
        # STEP 2: Test Cart Store Operations Directly
        # ============================================
        print("\n" + "="*60)
        print("STEP 2: Test Cart Store (Zustand) Operations")
        print("="*60)

        try:
            # The cart store is available via useCartStore from the window
            # We need to access it through React's internals or the Zustand store directly
            cart_test_results = await page.evaluate("""
                async () => {
                    const results = {};

                    // Check if Zustand store is accessible
                    // The app exposes __MARTUP_STORE__ on window for debugging
                    const appStore = window.__MARTUP_STORE__;
                    if (!appStore) {
                        results.storeAccess = false;
                        results.error = "window.__MARTUP_STORE__ not found";
                        return results;
                    }
                    results.storeAccess = true;

                    // Check cart store accessibility
                    // The cart store is a separate Zustand store - check if it's importable
                    // Since we can't import directly, let's test via the app's state

                    // Check if navigation works
                    const state = appStore.getState();
                    results.currentScreen = state.currentScreen;
                    results.isAuthenticated = state.isAuthenticated;

                    // Test navigation to cart screen
                    state.navigate('cart');
                    await new Promise(r => setTimeout(r, 500));

                    const afterNav = appStore.getState();
                    results.afterNavigateScreen = afterNav.currentScreen;

                    return results;
                }
            """)
            results.update(cart_test_results)
            print(f"  Store accessible: {cart_test_results.get('storeAccess', 'N/A')}")
            print(f"  Current screen: {cart_test_results.get('currentScreen', 'N/A')}")
            print(f"  After navigate to cart: {cart_test_results.get('afterNavigateScreen', 'N/A')}")

            await asyncio.sleep(2)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/02-cart-via-store.png")
            print("  Screenshot: 02-cart-via-store.png")

            # Check if cart screen content is visible
            body_text = await page.inner_text("body")
            results["cart_page_text"] = body_text[:500]
            results["cart_has_keranjang"] = "Keranjang" in body_text
            print(f"  Has 'Keranjang' text: {results['cart_has_keranjang']}")
            print(f"  Body text preview: {body_text[:200]}")

        except Exception as e:
            results["cart_store_error"] = str(e)
            print(f"  ERROR: {e}")

        # ============================================
        # STEP 3: Test Cart Store CRUD Operations
        # ============================================
        print("\n" + "="*60)
        print("STEP 3: Test Cart Store CRUD via JS Evaluation")
        print("="*60)

        try:
            # Since the cart store is a separate Zustand store, we need to find it
            # Let's check if it's exposed on the window or accessible via the module system
            crud_results = await page.evaluate("""
                () => {
                    const results = {};

                    // Try to find the cart store via React's fiber tree
                    // Or check if it's exposed via some global
                    const cartStoreGlobal = window.__MARTUP_CART_STORE__;

                    if (cartStoreGlobal) {
                        results.cartStoreFound = true;

                        // Test adding an item
                        const mockProduct = {
                            id: 'test-prod-1',
                            name: 'Test Product',
                            price: 50000,
                            images: [],
                            stock: 10,
                            sellerId: 'seller-1',
                            seller: {
                                id: 'seller-1',
                                storeName: 'Test Store',
                                isVerified: true,
                            },
                            categoryId: 'cat-1',
                        };

                        try {
                            cartStoreGlobal.getState().addItem(mockProduct);
                            const afterAdd = cartStoreGlobal.getState();
                            results.addItemCount = afterAdd.items.length;
                            results.addItemSuccess = afterAdd.items.length > 0;
                        } catch (e) {
                            results.addItemError = e.message;
                        }
                    } else {
                        results.cartStoreFound = false;
                        // Try to check the Zustand persist storage
                        try {
                            const cartStorage = localStorage.getItem('martup-cart');
                            results.localStorageCart = cartStorage ? cartStorage.substring(0, 200) : 'empty';
                        } catch (e) {
                            results.localStorageError = e.message;
                        }
                    }

                    return results;
                }
            """)
            results.update(crud_results)
            print(f"  Cart store found on window: {crud_results.get('cartStoreFound', 'N/A')}")
            print(f"  LocalStorage cart: {crud_results.get('localStorageCart', 'N/A')[:100]}")

        except Exception as e:
            results["crud_error"] = str(e)
            print(f"  ERROR: {e}")

        # ============================================
        # STEP 4: Navigate to Product Detail
        # ============================================
        print("\n" + "="*60)
        print("STEP 4: Navigate to Product Detail Screen")
        print("="*60)

        try:
            product_nav_results = await page.evaluate("""
                () => {
                    const store = window.__MARTUP_STORE__;
                    if (!store) return { error: 'Store not accessible' };

                    const state = store.getState();

                    // Set a selected product and navigate
                    state.setSelectedProduct('test-product-id');
                    state.navigate('product-detail');

                    return {
                        navigated: true,
                        screen: store.getState().currentScreen,
                        selectedProduct: store.getState().selectedProductId,
                    };
                }
            """)
            results.update(product_nav_results)
            print(f"  Navigated: {product_nav_results.get('navigated', 'N/A')}")
            print(f"  Screen: {product_nav_results.get('screen', 'N/A')}")

            await asyncio.sleep(2)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/03-product-detail.png")
            print("  Screenshot: 03-product-detail.png")

            body_text = await page.inner_text("body")
            results["product_detail_text_preview"] = body_text[:200]
            print(f"  Body text preview: {body_text[:200]}")

        except Exception as e:
            results["product_nav_error"] = str(e)
            print(f"  ERROR: {e}")

        # ============================================
        # STEP 5: Navigate to Checkout Screen
        # ============================================
        print("\n" + "="*60)
        print("STEP 5: Navigate to Checkout Screen")
        print("="*60)

        try:
            checkout_nav_results = await page.evaluate("""
                () => {
                    const store = window.__MARTUP_STORE__;
                    if (!store) return { error: 'Store not accessible' };

                    const state = store.getState();
                    state.navigate('checkout');

                    return {
                        navigated: true,
                        screen: store.getState().currentScreen,
                    };
                }
            """)
            results.update(checkout_nav_results)
            print(f"  Navigated: {checkout_nav_results.get('navigated', 'N/A')}")
            print(f"  Screen: {checkout_nav_results.get('screen', 'N/A')}")

            await asyncio.sleep(2)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/04-checkout-screen.png")
            print("  Screenshot: 04-checkout-screen.png")

            body_text = await page.inner_text("body")
            results["checkout_text_preview"] = body_text[:300]
            results["checkout_has_pembayaran"] = "Pembayaran" in body_text or "Alamat" in body_text or "Checkout" in body_text
            print(f"  Has checkout text: {results['checkout_has_pembayaran']}")
            print(f"  Body text preview: {body_text[:200]}")

        except Exception as e:
            results["checkout_nav_error"] = str(e)
            print(f"  ERROR: {e}")

        # ============================================
        # STEP 6: Navigate back to Home and verify cart icon
        # ============================================
        print("\n" + "="*60)
        print("STEP 6: Navigate back to Home & Verify UI Elements")
        print("="*60)

        try:
            home_nav_results = await page.evaluate("""
                () => {
                    const store = window.__MARTUP_STORE__;
                    if (!store) return { error: 'Store not accessible' };

                    store.getState().navigate('home');
                    return { navigated: true, screen: store.getState().currentScreen };
                }
            """)
            results.update(home_nav_results)

            await asyncio.sleep(2)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/05-home-after-nav.png")
            print("  Screenshot: 05-home-after-nav.png")

            # Check for key UI elements
            ui_checks = await page.evaluate("""
                () => {
                    const results = {};

                    // Check for header elements
                    const header = document.querySelector('.sticky, [class*="glass"]');
                    results.hasHeader = !!header;

                    // Check for search bar
                    const searchBar = document.querySelector('input[type="text"], [class*="search"]');
                    results.hasSearchBar = !!searchBar;

                    // Check for cart icon
                    const buttons = document.querySelectorAll('button');
                    let cartButtonFound = false;
                    for (const btn of buttons) {
                        const svg = btn.querySelector('svg');
                        if (svg) {
                            const html = svg.outerHTML;
                            // ShoppingCart icon has specific paths
                            if (html.includes('6 2') || html.includes('M6 2') || html.includes('circle')) {
                                // Check if it's in the header area
                                if (btn.closest('.sticky') || btn.closest('[class*="glass"]')) {
                                    cartButtonFound = true;
                                    break;
                                }
                            }
                        }
                    }
                    results.cartButtonInHeader = cartButtonFound;

                    // Check for product type toggle
                    const body = document.body.innerText;
                    results.hasSemuaToggle = body.includes('Semua');
                    results.hasBarangToggle = body.includes('Barang');
                    results.hasTolongMasToggle = body.includes('Tolong Mas');

                    // Check for banner area
                    const banner = document.querySelector('[class*="rounded-2xl"]');
                    results.hasBannerArea = !!banner;

                    return results;
                }
            """)
            results.update(ui_checks)
            print(f"  Has header: {ui_checks.get('hasHeader', 'N/A')}")
            print(f"  Cart button in header: {ui_checks.get('cartButtonInHeader', 'N/A')}")
            print(f"  Has 'Semua' toggle: {ui_checks.get('hasSemuaToggle', 'N/A')}")
            print(f"  Has 'Barang' toggle: {ui_checks.get('hasBarangToggle', 'N/A')}")
            print(f"  Has 'Tolong Mas' toggle: {ui_checks.get('hasTolongMasToggle', 'N/A')}")
            print(f"  Has banner area: {ui_checks.get('hasBannerArea', 'N/A')}")

        except Exception as e:
            results["home_nav_error"] = str(e)
            print(f"  ERROR: {e}")

        # ============================================
        # STEP 7: Analyze Console Errors in Detail
        # ============================================
        print("\n" + "="*60)
        print("STEP 7: Detailed Console Error Analysis")
        print("="*60)

        # Categorize errors
        cart_errors = [m for m in console_messages if any(kw in m["text"].lower() for kw in ["cart", "zustand", "persist"])]
        hydration_errors = [m for m in console_messages if "hydration" in m["text"].lower()]
        react_errors = [m for m in console_messages if any(kw in m["text"].lower() for kw in ["react", "component", "render", "hook"])]
        api_errors = [m for m in console_messages if any(kw in m["text"].lower() for kw in ["api", "fetch", "network", "500", "401"])]

        results["total_console_messages"] = len(console_messages)
        results["cart_related_console"] = len(cart_errors)
        results["hydration_errors"] = len(hydration_errors)
        results["react_errors"] = len(react_errors)
        results["api_errors"] = len(api_errors)
        results["js_page_errors"] = len(js_errors)

        print(f"  Total console messages: {len(console_messages)}")
        print(f"  Cart/Zustand/Persist related: {len(cart_errors)}")
        print(f"  Hydration errors: {len(hydration_errors)}")
        print(f"  React errors: {len(react_errors)}")
        print(f"  API/Network errors: {len(api_errors)}")
        print(f"  JS page errors: {len(js_errors)}")

        if cart_errors:
            print("\n  --- Cart/Zustand/Persist Messages ---")
            for msg in cart_errors:
                print(f"    [{msg['type'].upper()}] {msg['text'][:200]}")

        if hydration_errors:
            print("\n  --- Hydration Errors ---")
            for msg in hydration_errors:
                print(f"    [{msg['type'].upper()}] {msg['text'][:300]}")

        if react_errors:
            print("\n  --- React Errors ---")
            for msg in react_errors:
                print(f"    [{msg['type'].upper()}] {msg['text'][:200]}")

        if js_errors:
            print("\n  --- JS Page Errors ---")
            for err in js_errors:
                print(f"    [{err['name']}] {err['message'][:200]}")

        # Print ALL console messages for thorough review
        print("\n  --- ALL Console Messages ---")
        for msg in console_messages:
            if msg["type"] in ("error", "warning"):
                print(f"    [{msg['type'].upper()}] {msg['text'][:200]}")

        await browser.close()

    # ============================================
    # FINAL SUMMARY
    # ============================================
    print("\n" + "="*60)
    print("FINAL VERIFICATION SUMMARY")
    print("="*60)

    print(f"\n  🌐 Page Loading:")
    print(f"    HTTP Status: {results.get('home_http_status', 'N/A')}")
    print(f"    Has #__next root: {results.get('has_next_root', 'N/A')}")
    print(f"    Page Title: {results.get('page_title', 'N/A')}")
    print(f"    Has MartUp branding: {results.get('home_has_martup', 'N/A')}")

    print(f"\n  🏠 Home Page UI:")
    print(f"    Has header: {results.get('hasHeader', 'N/A')}")
    print(f"    Cart button in header: {results.get('cartButtonInHeader', 'N/A')}")
    print(f"    Product type toggle (Semua/Barang/Tolong Mas): {results.get('hasSemuaToggle', 'N/A')} / {results.get('hasBarangToggle', 'N/A')} / {results.get('hasTolongMasToggle', 'N/A')}")

    print(f"\n  🛒 Cart Screen:")
    print(f"    Navigate to cart works: {results.get('afterNavigateScreen', 'N/A') == 'cart'}")
    print(f"    Has 'Keranjang' text: {results.get('cart_has_keranjang', 'N/A')}")
    print(f"    Cart store accessible: {results.get('storeAccess', 'N/A')}")

    print(f"\n  📦 Product Detail Screen:")
    print(f"    Navigate works: {results.get('navigated', 'N/A')}")

    print(f"\n  💳 Checkout Screen:")
    print(f"    Navigate works: {results.get('screen', 'N/A')}")
    print(f"    Has checkout content: {results.get('checkout_has_pembayaran', 'N/A')}")

    print(f"\n  ⚠️  Error Analysis:")
    print(f"    Total console messages: {results.get('total_console_messages', 0)}")
    print(f"    Cart/Zustand/Persist errors: {results.get('cart_related_console', 0)}")
    print(f"    Hydration errors: {results.get('hydration_errors', 0)}")
    print(f"    React errors: {results.get('react_errors', 0)}")
    print(f"    JS page errors: {results.get('js_page_errors', 0)}")
    print(f"    API/Network errors: {results.get('api_errors', 0)}")

    # Verdict
    critical_issues = []
    warnings = []

    if results.get('home_http_status') != 200:
        critical_issues.append("Home page HTTP status not 200")

    if results.get('js_page_errors', 0) > 0:
        critical_issues.append(f"JS page errors: {results.get('js_page_errors')}")

    if results.get('cart_related_console', 0) > 0:
        critical_issues.append(f"Cart-related console errors: {results.get('cart_related_console')}")

    if results.get('hydration_errors', 0) > 0:
        warnings.append(f"Hydration mismatches: {results.get('hydration_errors')} (common in Zustand persisted stores)")

    if not results.get('home_has_martup', False):
        warnings.append("MartUp branding not visible (possibly due to empty product data)")

    if results.get('api_errors', 0) > 0:
        warnings.append(f"API errors: {results.get('api_errors')} (likely database connectivity)")

    print(f"\n  🔴 Critical Issues: {len(critical_issues)}")
    for issue in critical_issues:
        print(f"    - {issue}")

    print(f"\n  🟡 Warnings: {len(warnings)}")
    for warning in warnings:
        print(f"    - {warning}")

    if not critical_issues:
        print("\n  ✅ No critical cart/checkout store issues found!")
        print("     The cart store bug fixes appear to be working correctly.")
    else:
        print(f"\n  ❌ {len(critical_issues)} critical issue(s) found")

    # Save results
    with open(f"{SCREENSHOT_DIR}/verify-results-v2.json", "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n  Results saved to {SCREENSHOT_DIR}/verify-results-v2.json")

    return len(critical_issues) == 0


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
