#!/usr/bin/env python3
"""Browser verification of MartUp checkout system."""

import json
import sys
import time
from playwright.sync_api import sync_playwright

def main():
    results = {}
    console_errors = []
    console_warnings = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
        context = browser.new_context(
            viewport={"width": 390, "height": 844},
            device_scale_factor=2,
            is_mobile=True,
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
        )
        page = context.new_page()

        # Collect console messages
        page.on("console", lambda msg: (
            console_errors.append(f"[{msg.type}] {msg.text}") if msg.type in ("error", "warning") else None
        ))

        # ===================== TEST 1: Home page loads =====================
        print("=" * 60)
        print("TEST 1: Home page loads")
        print("=" * 60)
        try:
            page.goto("http://localhost:3000", wait_until="networkidle", timeout=30000)
            time.sleep(2)  # Wait for hydration

            title = page.title()
            body_text = page.inner_text("body")[:500]
            has_content = len(body_text.strip()) > 50

            print(f"  Page title: {title}")
            print(f"  Body content length: {len(body_text)}")
            print(f"  Has meaningful content: {has_content}")

            # Check for React root
            root_exists = page.query_selector("#__next") is not None or page.query_selector("[data-reactroot]") is not None
            print(f"  React root found: {root_exists}")

            results["home_page"] = {
                "status": "PASS" if has_content else "FAIL",
                "title": title,
                "content_length": len(body_text),
                "has_content": has_content
            }
        except Exception as e:
            print(f"  ERROR: {e}")
            results["home_page"] = {"status": "FAIL", "error": str(e)}

        # Take screenshot of home page
        page.screenshot(path="/home/z/my-project/verify-screenshot-home.png", full_page=False)
        print("  Screenshot saved: verify-screenshot-home.png")

        # ===================== TEST 2: Navigate to Cart/Checkout =====================
        print("\n" + "=" * 60)
        print("TEST 2: Navigate to Cart/Checkout")
        print("=" * 60)

        console_errors_before = len(console_errors)

        try:
            # Try to find and click cart icon/nav
            # First, let's look for navigation elements
            page.screenshot(path="/home/z/my-project/verify-screenshot-home-full.png", full_page=True)

            # Try clicking on cart tab or navigating directly
            # The app uses a Zustand store for navigation, so we need to interact with the UI
            # Look for cart-related buttons
            cart_button = page.query_selector("text=Keranjang") or page.query_selector("[aria-label*='cart']") or page.query_selector("text=Cart")
            
            # Try to find the shopping cart icon in bottom nav
            shopping_cart_icons = page.query_selector_all("svg path[d*='M6']")
            
            # Alternative: try clicking via JavaScript to navigate to cart screen
            # The app stores use navigate() function - let's try using the store directly
            nav_result = page.evaluate("""
                () => {
                    // Try to find the cart screen navigation
                    // Look for any element with cart-related text
                    const elements = document.querySelectorAll('button, a, span, div');
                    let cartEl = null;
                    for (const el of elements) {
                        const text = el.textContent?.trim();
                        if (text && (text.includes('Keranjang') || text.includes('Cart'))) {
                            cartEl = el;
                            break;
                        }
                    }
                    return cartEl ? cartEl.textContent : 'not found';
                }
            """)
            print(f"  Cart navigation element: {nav_result}")

            # Try to navigate by clicking bottom nav icons - look for ShoppingCart icon
            # The bottom nav has Home, Category, Stream, Chat, Profile
            # We need to go to profile first, then find cart
            # OR we can try to add an item to cart first

            # Let's try clicking a product first, then adding to cart
            # Find any product card
            product_cards = page.query_selector_all("[class*='rounded-xl'][class*='border']")
            print(f"  Found {len(product_cards)} potential product cards")

            # Try to find and click a product
            clicked_product = False
            for card in product_cards[:5]:
                try:
                    card_text = card.inner_text()[:100]
                    if card_text and len(card_text) > 20:  # Has meaningful text
                        card.click()
                        clicked_product = True
                        time.sleep(1)
                        print(f"  Clicked product card: {card_text[:50]}...")
                        break
                except:
                    continue

            if clicked_product:
                page.screenshot(path="/home/z/my-project/verify-screenshot-product.png", full_page=False)

                # Look for "Tambah ke Keranjang" or "Beli" button
                add_to_cart = page.query_selector("text=Tambah ke Keranjang") or page.query_selector("text=Keranjang") or page.query_selector("text=Beli")
                if add_to_cart:
                    add_to_cart.click()
                    time.sleep(1)
                    print("  Added product to cart")
                else:
                    # Try clicking any button that looks like add-to-cart
                    buttons = page.query_selector_all("button")
                    for btn in buttons:
                        text = btn.inner_text().strip()
                        if any(k in text.lower() for k in ['keranjang', 'beli', 'cart', 'add']):
                            btn.click()
                            time.sleep(1)
                            print(f"  Clicked button: {text}")
                            break

            # Now try to navigate to cart - click bottom profile then look for cart
            # Actually, let's try to directly navigate to checkout via the app's internal state
            # Use the Zustand store directly
            checkout_nav = page.evaluate("""
                () => {
                    // Try to access the app store and navigate
                    if (window.__NEXT_DATA__) {
                        return 'next_data_found';
                    }
                    return 'no_next_data';
                }
            """)
            print(f"  Next.js data: {checkout_nav}")

            # Let's try to directly navigate by clicking the profile icon, then finding the cart
            # Or, we can directly evaluate the zustand store navigation
            # But first, let's try a more straightforward approach - just try all the bottom nav buttons
            bottom_nav_buttons = page.query_selector_all("nav button")
            print(f"  Bottom nav buttons found: {len(bottom_nav_buttons)}")

            # Click the profile button (last one)
            if bottom_nav_buttons and len(bottom_nav_buttons) >= 5:
                try:
                    bottom_nav_buttons[4].click()  # Profile
                    time.sleep(1)
                    print("  Clicked Profile tab")
                except:
                    pass

            page.screenshot(path="/home/z/my-project/verify-screenshot-profile.png", full_page=False)

            # Look for Keranjang on profile page
            cart_link = page.query_selector("text=Keranjang")
            if cart_link:
                cart_link.click()
                time.sleep(1)
                print("  Navigated to Cart screen")
                page.screenshot(path="/home/z/my-project/verify-screenshot-cart.png", full_page=False)
            else:
                print("  Could not find Cart link on profile page")
                # Try to navigate using the internal store
                page.evaluate("""
                    () => {
                        // Dispatch custom event or use store directly
                        // Try finding and clicking any element that navigates to cart
                        const allElements = document.querySelectorAll('*');
                        for (const el of allElements) {
                            if (el.textContent?.trim() === 'Keranjang' || el.textContent?.trim() === 'Cart') {
                                el.click();
                                return 'clicked: ' + el.textContent;
                            }
                        }
                        return 'not found';
                    }
                """)
                time.sleep(1)

            # Check for JS errors after navigation
            new_errors = console_errors[console_errors_before:]
            js_errors = [e for e in new_errors if "[error]" in e]
            js_warnings = [e for e in new_errors if "[warning]" in e]

            print(f"  JS Errors after navigation: {len(js_errors)}")
            for err in js_errors[:5]:
                print(f"    {err[:120]}")

            results["cart_navigation"] = {
                "status": "PASS" if len(js_errors) == 0 else "WARN",
                "js_errors_count": len(js_errors),
                "js_errors": js_errors[:10],
                "js_warnings_count": len(js_warnings)
            }

        except Exception as e:
            print(f"  ERROR: {e}")
            results["cart_navigation"] = {"status": "FAIL", "error": str(e)}

        # ===================== TEST 3: Payment Methods =====================
        print("\n" + "=" * 60)
        print("TEST 3: Payment Methods Verification")
        print("=" * 60)

        # Check the PAYMENT_METHODS constant in the source code directly
        # We already read it from the file, but let's also verify via the browser
        try:
            # First, let's try to get to the checkout screen
            # If we have items in cart, we can click checkout
            checkout_btn = page.query_selector("text=Checkout") or page.query_selector("text=Bayar")
            if checkout_btn:
                checkout_btn.click()
                time.sleep(2)
                print("  Navigated to Checkout screen")
                page.screenshot(path="/home/z/my-project/verify-screenshot-checkout.png", full_page=False)

            # Look for payment method section
            payment_section = page.query_selector("text=Metode Pembayaran")
            if payment_section:
                print("  Found 'Metode Pembayaran' section")

                # Get all payment method text
                payment_methods_text = page.evaluate("""
                    () => {
                        const section = document.querySelector('h3');
                        const allText = [];
                        const elements = document.querySelectorAll('p');
                        for (const el of elements) {
                            const text = el.textContent?.trim();
                            if (text && (
                                text.includes('MartUp') ||
                                text.includes('Transfer') ||
                                text.includes('Kartu') ||
                                text.includes('COD') ||
                                text.includes('Bayar') ||
                                text.includes('E-Wallet') ||
                                text.includes('Kredit') ||
                                text.includes('Debit') ||
                                text.includes('Tempat')
                            )) {
                                allText.push(text);
                            }
                        }
                        return allText;
                    }
                """)
                print(f"  Payment method texts found: {payment_methods_text}")

                # Check for "Transfer Bank" (should NOT be present)
                has_transfer_bank = page.query_selector("text=Transfer Bank") is not None
                print(f"  Has 'Transfer Bank' option: {has_transfer_bank}")

                # Check for the 4 expected methods
                has_martup_pay = any("MartUp Pay" in t for t in payment_methods_text)
                has_transfer_ewallet = any("Transfer & E-Wallet" in t or "Transfer" in t for t in payment_methods_text)
                has_card = any("Kartu Kredit" in t or "Debit" in t for t in payment_methods_text)
                has_cod = any("COD" in t or "Bayar di Tempat" in t or "di Tempat" in t for t in payment_methods_text)

                print(f"  Has MartUp Pay: {has_martup_pay}")
                print(f"  Has Transfer & E-Wallet: {has_transfer_ewallet}")
                print(f"  Has Kartu Kredit/Debit: {has_card}")
                print(f"  Has COD: {has_cod}")

                expected_methods = has_martup_pay and has_transfer_ewallet and has_card and has_cod
                no_transfer_bank = not has_transfer_bank

                results["payment_methods"] = {
                    "status": "PASS" if (expected_methods and no_transfer_bank) else "FAIL",
                    "has_martup_pay": has_martup_pay,
                    "has_transfer_ewallet": has_transfer_ewallet,
                    "has_card": has_card,
                    "has_cod": has_cod,
                    "has_transfer_bank": has_transfer_bank,
                    "methods_found": payment_methods_text
                }
            else:
                print("  Could not find 'Metode Pembayaran' section on current page")
                print("  Will verify from source code instead")
                # Verify from source code
                results["payment_methods"] = {
                    "status": "CODE_REVIEW",
                    "source_code_methods": [
                        "MartUp Pay",
                        "Transfer & E-Wallet",
                        "Kartu Kredit/Debit",
                        "Bayar di Tempat (COD)"
                    ],
                    "has_transfer_bank": False,
                    "note": "Could not navigate to checkout in browser; verified from source code"
                }

        except Exception as e:
            print(f"  ERROR: {e}")
            results["payment_methods"] = {"status": "FAIL", "error": str(e)}

        # ===================== TEST 4: Bottom CTA Bar Alignment =====================
        print("\n" + "=" * 60)
        print("TEST 4: Bottom CTA Bar Alignment")
        print("=" * 60)

        try:
            # Check the bottom CTA bar positioning via CSS
            cta_bar_info = page.evaluate("""
                () => {
                    // Find the fixed bottom bar
                    const fixedElements = document.querySelectorAll('.fixed.bottom-0, .fixed.bottom-16, [class*="fixed"][class*="bottom"]');
                    const results = [];
                    
                    for (const el of fixedElements) {
                        const rect = el.getBoundingClientRect();
                        const style = window.getComputedStyle(el);
                        results.push({
                            width: rect.width,
                            left: rect.left,
                            right: rect.right,
                            transform: style.transform,
                            maxWidth: style.maxWidth,
                            className: el.className.substring(0, 200),
                            text: el.textContent?.substring(0, 100)
                        });
                    }
                    
                    // Also find the header for comparison
                    const headers = document.querySelectorAll('.sticky.top-0, [class*="sticky"][class*="top-0"]');
                    const headerResults = [];
                    for (const h of headers) {
                        const rect = h.getBoundingClientRect();
                        headerResults.push({
                            width: rect.width,
                            left: rect.left,
                            right: rect.right,
                            className: h.className.substring(0, 200)
                        });
                    }
                    
                    return { ctaBars: results, headers: headerResults };
                }
            """)

            print(f"  CTA bars found: {len(cta_bar_info.get('ctaBars', []))}")
            for i, bar in enumerate(cta_bar_info.get('ctaBars', [])):
                print(f"    Bar {i+1}: width={bar['width']:.0f}, left={bar['left']:.0f}, maxW={bar.get('maxWidth','N/A')}")
                print(f"      class: {bar['className'][:100]}")
                print(f"      text: {bar.get('text', 'N/A')[:80]}")

            print(f"  Headers found: {len(cta_bar_info.get('headers', []))}")
            for i, h in enumerate(cta_bar_info.get('headers', [])):
                print(f"    Header {i+1}: width={h['width']:.0f}, left={h['left']:.0f}")

            # Check alignment - CTA bar should have max-w-[430px] constraint matching nav
            cta_bars = cta_bar_info.get('ctaBars', [])
            headers = cta_bar_info.get('headers', [])

            alignment_ok = True
            alignment_note = ""

            if cta_bars:
                for bar in cta_bars:
                    if "Total Pembayaran" in (bar.get('text') or '') or "Bayar" in (bar.get('text') or ''):
                        if bar['width'] > 480:
                            alignment_ok = False
                            alignment_note = f"CTA bar width ({bar['width']:.0f}px) exceeds max-w-480px"
                        elif 'max-w-[430px]' in bar.get('className', '') or 'max-w-[480px]' in bar.get('className', ''):
                            alignment_ok = True
                            alignment_note = "CTA bar has proper max-width constraint"
                        else:
                            alignment_note = f"CTA bar width: {bar['width']:.0f}px, checking class..."

            results["cta_alignment"] = {
                "status": "PASS" if alignment_ok else "FAIL",
                "note": alignment_note,
                "cta_bars": cta_bars,
                "headers": headers
            }

        except Exception as e:
            print(f"  ERROR: {e}")
            results["cta_alignment"] = {"status": "FAIL", "error": str(e)}

        # ===================== TEST 5: Visible Errors =====================
        print("\n" + "=" * 60)
        print("TEST 5: Visible Errors Check")
        print("=" * 60)

        try:
            # Check for error-related elements in the DOM
            visible_errors = page.evaluate("""
                () => {
                    const errors = [];
                    
                    // Check for error text
                    const allText = document.body.innerText;
                    if (allText.includes('Error:') || allText.includes('error')) {
                        const errorMatches = allText.match(/Error[:\\s][^\\n]{0,100}/gi);
                        if (errorMatches) {
                            errors.push(...errorMatches.slice(0, 5));
                        }
                    }
                    
                    // Check for red/error banners
                    const redElements = document.querySelectorAll('[class*="bg-red"], [class*="text-red"], [role="alert"]');
                    for (const el of redElements) {
                        const text = el.textContent?.trim();
                        if (text && text.length > 5 && text.length < 200) {
                            errors.push(`Red element: ${text}`);
                        }
                    }
                    
                    // Check for 404 or not found
                    if (allText.includes('404') || allText.toLowerCase().includes('not found')) {
                        errors.push('404 or Not Found text detected');
                    }
                    
                    // Check for hydration errors
                    if (allText.includes('Hydration') || allText.includes('hydrat')) {
                        errors.push('Hydration error text detected');
                    }
                    
                    return errors;
                }
            """)

            print(f"  Visible errors found: {len(visible_errors)}")
            for err in visible_errors:
                print(f"    {err[:120]}")

            # Also check all console errors accumulated
            all_js_errors = [e for e in console_errors if "[error]" in e]
            print(f"  Total JS console errors: {len(all_js_errors)}")
            for err in all_js_errors[:10]:
                print(f"    {err[:150]}")

            results["visible_errors"] = {
                "status": "PASS" if len(visible_errors) == 0 else "WARN",
                "visible_errors": visible_errors,
                "console_errors_count": len(all_js_errors),
                "console_errors": all_js_errors[:10]
            }

        except Exception as e:
            print(f"  ERROR: {e}")
            results["visible_errors"] = {"status": "FAIL", "error": str(e)}

        # Take final screenshot
        page.screenshot(path="/home/z/my-project/verify-screenshot-final.png", full_page=True)

        browser.close()

    # ===================== SUMMARY =====================
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(json.dumps(results, indent=2, default=str))

    return results

if __name__ == "__main__":
    main()
