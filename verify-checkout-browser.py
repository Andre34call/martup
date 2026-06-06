#!/usr/bin/env python3
"""
Browser verification script for checkout system after bug fixes.
Uses Playwright to:
1. Load home page and check for errors
2. Navigate to a product page
3. Navigate to the cart page
4. Capture console errors (especially cart store related)
5. Take screenshots at each step
"""

import asyncio
import json
import sys
from playwright.async_api import async_playwright

BASE_URL = "http://localhost:3000"
SCREENSHOT_DIR = "/home/z/my-project/verify-screenshots"

# Collect all console messages
console_messages = []
js_errors = []
network_errors = []

async def main():
    import os
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-setuid-sandbox']
        )
        context = await browser.new_context(
            viewport={"width": 430, "height": 932},  # Mobile viewport matching the app
            ignore_https_errors=True
        )
        page = await context.new_page()

        # Set up console message capture
        page.on("console", lambda msg: console_messages.append({
            "type": msg.type,
            "text": msg.text,
            "location": msg.location
        }))

        # Capture page errors
        page.on("pageerror", lambda err: js_errors.append({
            "message": str(err),
            "name": err.name,
            "stack": err.stack
        }))

        # Capture failed network requests
        page.on("requestfailed", lambda req: network_errors.append({
            "url": req.url,
            "failure": req.failure,
            "method": req.method
        }))

        results = {}

        # ============================================
        # STEP 1: Load Home Page
        # ============================================
        print("\n" + "="*60)
        print("STEP 1: Loading Home Page...")
        print("="*60)

        try:
            response = await page.goto(BASE_URL, wait_until="networkidle", timeout=30000)
            results["home_status"] = response.status if response else "no response"
            print(f"  HTTP Status: {results['home_status']}")

            # Wait a bit for React hydration
            await asyncio.sleep(3)

            # Take screenshot
            await page.screenshot(path=f"{SCREENSHOT_DIR}/01-home-page.png", full_page=False)
            print("  Screenshot saved: 01-home-page.png")

            # Check page title
            title = await page.title()
            results["home_title"] = title
            print(f"  Page Title: {title}")

            # Check for visible content
            body_text = await page.inner_text("body")
            results["home_has_content"] = len(body_text.strip()) > 10
            print(f"  Body content length: {len(body_text.strip())} chars")

            # Check if the MartUp branding is present
            results["home_has_martup"] = "MartUp" in body_text
            print(f"  Has 'MartUp' text: {results['home_has_martup']}")

            # Check for React root
            root_exists = await page.query_selector("#__next") is not None or await page.query_selector("[data-reactroot]") is not None
            results["home_has_react_root"] = root_exists
            print(f"  React root exists: {root_exists}")

        except Exception as e:
            results["home_error"] = str(e)
            print(f"  ERROR: {e}")

        # ============================================
        # STEP 2: Navigate to Product Page
        # ============================================
        print("\n" + "="*60)
        print("STEP 2: Navigate to a Product Page...")
        print("="*60)

        try:
            # The app uses internal screen navigation (not URL routing for products)
            # Try clicking on a product card if visible
            product_cards = await page.query_selector_all("[class*='product'], [class*='Product'], a[href*='product']")

            # If no product cards found via selector, try clicking on any card-like element
            if not product_cards:
                # Try to find any clickable product in the grid
                product_cards = await page.query_selector_all(".grid > div")

            if product_cards and len(product_cards) > 0:
                print(f"  Found {len(product_cards)} potential product elements")
                # Click the first product card
                try:
                    await product_cards[0].click()
                    await asyncio.sleep(2)
                    await page.screenshot(path=f"{SCREENSHOT_DIR}/02-product-page.png", full_page=False)
                    print("  Screenshot saved: 02-product-page.png")

                    # Check if product detail loaded
                    body_text = await page.inner_text("body")
                    results["product_page_has_content"] = len(body_text.strip()) > 10
                    results["product_page_loaded"] = True
                    print(f"  Product page content length: {len(body_text.strip())} chars")
                except Exception as click_err:
                    print(f"  Could not click product: {click_err}")
                    results["product_page_loaded"] = False
                    # Take screenshot of current state anyway
                    await page.screenshot(path=f"{SCREENSHOT_DIR}/02-product-page.png", full_page=False)
            else:
                print("  No product cards found on home page")
                results["product_page_loaded"] = False
                results["product_no_cards"] = True

        except Exception as e:
            results["product_error"] = str(e)
            print(f"  ERROR: {e}")

        # ============================================
        # STEP 3: Navigate to Cart Page
        # ============================================
        print("\n" + "="*60)
        print("STEP 3: Navigate to Cart Page...")
        print("="*60)

        try:
            # Go back to home first
            await page.goto(BASE_URL, wait_until="networkidle", timeout=15000)
            await asyncio.sleep(2)

            # The app uses internal navigation. Try to find and click the cart icon/button
            # Cart icon is in the header with ShoppingCart icon
            cart_button = None

            # Try multiple selectors for the cart button
            cart_selectors = [
                "button:has(svg.lucide-shopping-cart)",
                "[class*='shopping-cart']",
                "button:has(svg[class*='ShoppingCart'])",
            ]

            for selector in cart_selectors:
                try:
                    cart_button = await page.query_selector(selector)
                    if cart_button:
                        print(f"  Found cart button with selector: {selector}")
                        break
                except:
                    continue

            if not cart_button:
                # Try clicking by finding any element that navigates to cart
                # Look for buttons in the top bar area
                try:
                    # Use JavaScript to find and click the cart button
                    clicked = await page.evaluate("""
                        () => {
                            const buttons = document.querySelectorAll('button');
                            for (const btn of buttons) {
                                const svg = btn.querySelector('svg');
                                if (svg) {
                                    const paths = svg.querySelectorAll('path, circle');
                                    // ShoppingCart icon typically has circle elements
                                    if (btn.closest('.sticky') || btn.closest('[class*="glass"]')) {
                                        // This is likely a header button
                                        const inner = btn.innerHTML;
                                        if (inner.includes('cart') || inner.includes('Cart')) {
                                            btn.click();
                                            return true;
                                        }
                                    }
                                }
                            }
                            return false;
                        }
                    """)
                    print(f"  Cart button click via JS: {clicked}")
                except Exception as js_err:
                    print(f"  JS cart click failed: {js_err}")

            if cart_button:
                await cart_button.click()
                print("  Clicked cart button")
            else:
                # Try the second button in the header (usually cart)
                try:
                    await page.evaluate("""
                        () => {
                            const header = document.querySelector('.sticky');
                            if (header) {
                                const buttons = header.querySelectorAll('button');
                                // Typically: search, cart, bell, chat
                                if (buttons.length >= 2) {
                                    buttons[1].click(); // Cart button
                                    return true;
                                }
                            }
                            return false;
                        }
                    """)
                    print("  Clicked second header button (assumed cart)")
                except:
                    pass

            await asyncio.sleep(3)
            await page.screenshot(path=f"{SCREENSHOT_DIR}/03-cart-page.png", full_page=False)
            print("  Screenshot saved: 03-cart-page.png")

            # Check cart page content
            body_text = await page.inner_text("body")
            results["cart_page_has_content"] = len(body_text.strip()) > 10
            results["cart_page_loaded"] = True

            # Check for cart-specific text
            has_keranjang = "Keranjang" in body_text or "cart" in body_text.lower()
            results["cart_has_cart_text"] = has_keranjang
            print(f"  Has cart text ('Keranjang'): {has_keranjang}")
            print(f"  Cart page content length: {len(body_text.strip())} chars")

        except Exception as e:
            results["cart_error"] = str(e)
            print(f"  ERROR: {e}")

        # ============================================
        # STEP 4: Check Console Errors
        # ============================================
        print("\n" + "="*60)
        print("STEP 4: Analyzing Console Errors...")
        print("="*60)

        # Filter for errors and warnings
        error_messages = [m for m in console_messages if m["type"] in ("error", "warning")]
        cart_related_errors = [m for m in console_messages if "cart" in m["text"].lower() or "Cart" in m["text"]]
        hydration_errors = [m for m in console_messages if "hydration" in m["text"].lower() or "Hydration" in m["text"]]
        zustand_errors = [m for m in console_messages if "zustand" in m["text"].lower() or "persist" in m["text"].lower()]

        results["total_console_messages"] = len(console_messages)
        results["error_count"] = len(error_messages)
        results["js_error_count"] = len(js_errors)
        results["network_error_count"] = len(network_errors)
        results["cart_related_console"] = len(cart_related_errors)
        results["hydration_errors"] = len(hydration_errors)
        results["zustand_errors"] = len(zustand_errors)

        print(f"  Total console messages: {len(console_messages)}")
        print(f"  Error/Warning messages: {len(error_messages)}")
        print(f"  JS page errors: {len(js_errors)}")
        print(f"  Network errors: {len(network_errors)}")
        print(f"  Cart-related console: {len(cart_related_errors)}")
        print(f"  Hydration errors: {len(hydration_errors)}")
        print(f"  Zustand/persist errors: {len(zustand_errors)}")

        # Print relevant errors
        if error_messages:
            print("\n  --- Error/Warning Messages ---")
            for msg in error_messages[:20]:
                text = msg["text"][:200]
                print(f"    [{msg['type'].upper()}] {text}")

        if js_errors:
            print("\n  --- JavaScript Page Errors ---")
            for err in js_errors[:10]:
                print(f"    [{err['name']}] {str(err['message'])[:200]}")

        if hydration_errors:
            print("\n  --- Hydration Errors ---")
            for msg in hydration_errors:
                print(f"    {msg['text'][:300]}")

        if cart_related_errors:
            print("\n  --- Cart-Related Console ---")
            for msg in cart_related_errors:
                print(f"    [{msg['type'].upper()}] {msg['text'][:200]}")

        if network_errors:
            print("\n  --- Network Errors ---")
            for err in network_errors[:10]:
                print(f"    {err['method']} {err['url'][:100]} - {err['failure']}")

        # ============================================
        # STEP 5: Verify API endpoints
        # ============================================
        print("\n" + "="*60)
        print("STEP 5: Testing API Endpoints...")
        print("="*60)

        # Test cart API
        try:
            cart_resp = await page.request.get(f"{BASE_URL}/api/cart")
            cart_status = cart_resp.status
            cart_body = await cart_resp.text()
            results["cart_api_status"] = cart_status
            print(f"  GET /api/cart: {cart_status}")
            try:
                cart_json = json.loads(cart_body)
                print(f"  Cart API response: success={cart_json.get('success', 'N/A')}")
                if cart_json.get('data'):
                    print(f"  Cart items count: {len(cart_json['data']) if isinstance(cart_json['data'], list) else 'N/A'}")
            except:
                print(f"  Cart API response (raw): {cart_body[:200]}")
        except Exception as e:
            results["cart_api_error"] = str(e)
            print(f"  GET /api/cart ERROR: {e}")

        # Test products API
        try:
            products_resp = await page.request.get(f"{BASE_URL}/api/products")
            products_status = products_resp.status
            products_body = await products_resp.text()
            results["products_api_status"] = products_status
            print(f"  GET /api/products: {products_status}")
            try:
                products_json = json.loads(products_body)
                if products_json.get('data') and isinstance(products_json['data'], list):
                    results["products_count"] = len(products_json['data'])
                    print(f"  Products available: {len(products_json['data'])}")
                    # Save first product ID for later
                    if products_json['data']:
                        results["first_product_id"] = products_json['data'][0].get('id', 'N/A')
                        results["first_product_name"] = products_json['data'][0].get('name', 'N/A')
            except:
                pass
        except Exception as e:
            results["products_api_error"] = str(e)
            print(f"  GET /api/products ERROR: {e}")

        # Test health API
        try:
            health_resp = await page.request.get(f"{BASE_URL}/api/health")
            health_status = health_resp.status
            results["health_api_status"] = health_status
            print(f"  GET /api/health: {health_status}")
        except Exception as e:
            print(f"  GET /api/health ERROR: {e}")

        # ============================================
        # STEP 6: Take final state screenshot
        # ============================================
        print("\n" + "="*60)
        print("STEP 6: Final Screenshots...")
        print("="*60)

        # Screenshot of whatever page we're on now
        await page.screenshot(path=f"{SCREENSHOT_DIR}/04-final-state.png", full_page=False)
        print("  Screenshot saved: 04-final-state.png")

        # Take a full page screenshot for debugging
        await page.screenshot(path=f"{SCREENSHOT_DIR}/05-full-page.png", full_page=True)
        print("  Screenshot saved: 05-full-page.png")

        await browser.close()

    # ============================================
    # SUMMARY
    # ============================================
    print("\n" + "="*60)
    print("VERIFICATION SUMMARY")
    print("="*60)

    print(f"\n  Home Page:")
    print(f"    Status: {results.get('home_status', 'N/A')}")
    print(f"    Has MartUp branding: {results.get('home_has_martup', 'N/A')}")
    print(f"    Has content: {results.get('home_has_content', 'N/A')}")
    print(f"    Error: {results.get('home_error', 'None')}")

    print(f"\n  Product Page:")
    print(f"    Loaded: {results.get('product_page_loaded', 'N/A')}")
    print(f"    Has content: {results.get('product_page_has_content', 'N/A')}")
    print(f"    Error: {results.get('product_error', 'None')}")

    print(f"\n  Cart Page:")
    print(f"    Loaded: {results.get('cart_page_loaded', 'N/A')}")
    print(f"    Has cart text: {results.get('cart_has_cart_text', 'N/A')}")
    print(f"    Error: {results.get('cart_error', 'None')}")

    print(f"\n  Console Errors:")
    print(f"    Total messages: {results.get('total_console_messages', 0)}")
    print(f"    Errors/Warnings: {results.get('error_count', 0)}")
    print(f"    JS Page Errors: {results.get('js_error_count', 0)}")
    print(f"    Network Errors: {results.get('network_error_count', 0)}")
    print(f"    Cart-Related: {results.get('cart_related_console', 0)}")
    print(f"    Hydration Errors: {results.get('hydration_errors', 0)}")
    print(f"    Zustand/Persist Errors: {results.get('zustand_errors', 0)}")

    print(f"\n  API Endpoints:")
    print(f"    /api/cart: {results.get('cart_api_status', 'N/A')}")
    print(f"    /api/products: {results.get('products_api_status', 'N/A')} ({results.get('products_count', 0)} products)")
    print(f"    /api/health: {results.get('health_api_status', 'N/A')}")

    # Determine overall status
    critical_errors = []
    if results.get('home_status') != 200:
        critical_errors.append("Home page did not return HTTP 200")
    if results.get('js_error_count', 0) > 0:
        critical_errors.append(f"JS errors detected: {results.get('js_error_count')}")
    if results.get('hydration_errors', 0) > 0:
        critical_errors.append(f"Hydration errors: {results.get('hydration_errors')}")
    if results.get('cart_api_status') not in (200, 401):
        critical_errors.append(f"Cart API returned non-200: {results.get('cart_api_status')}")

    print(f"\n  CRITICAL ISSUES: {len(critical_errors)}")
    for issue in critical_errors:
        print(f"    - {issue}")

    if not critical_errors:
        print("\n  ✅ No critical issues found!")
    else:
        print(f"\n  ❌ {len(critical_errors)} critical issue(s) found")

    # Save results to JSON
    with open(f"{SCREENSHOT_DIR}/verify-results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n  Results saved to {SCREENSHOT_DIR}/verify-results.json")

    return len(critical_errors) == 0


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
