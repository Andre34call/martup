#!/usr/bin/env python3
"""Take screenshots of checkout and order detail pages to verify UI text changes."""

import time
import os
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000"
SCREENSHOT_DIR = "/home/z/my-project/test-screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    context = browser.new_context(
        viewport={'width': 390, 'height': 844},
        device_scale_factor=2
    )
    page = context.new_page()
    
    # Go to home page first
    page.goto(BASE_URL)
    page.wait_for_timeout(3000)
    page.screenshot(path=os.path.join(SCREENSHOT_DIR, "home_page.png"), full_page=True)
    print("✅ Home page screenshot taken")
    
    # Check for payment method text in the source
    # We need to check the JavaScript bundle for the payment method definitions
    # Let's use the browser console to check
    result = page.evaluate("""() => {
        // Check if the app's store is available
        const store = window.__MARTUP_STORE__;
        if (!store) return { error: 'Store not found on window' };
        
        // Get the current state
        const state = store.getState();
        return {
            hasStore: true,
            currentScreen: state.currentScreen,
            isAuthenticated: state.isAuthenticated,
        };
    }""")
    print(f"Store check: {result}")
    
    # Try to log in with test credentials
    print("\n--- Attempting login ---")
    page.goto(f"{BASE_URL}")
    page.wait_for_timeout(2000)
    
    # Set screen to login
    result = page.evaluate("""() => {
        const store = window.__MARTUP_STORE__;
        if (!store) return { error: 'No store' };
        store.getState().navigate('login');
        return { navigated: true };
    }""")
    page.wait_for_timeout(2000)
    page.screenshot(path=os.path.join(SCREENSHOT_DIR, "login_page.png"), full_page=True)
    print("✅ Login page screenshot taken")
    
    # Try to register/login with test credentials
    # Fill in the login form if visible
    try:
        email_input = page.locator('input[type="email"], input[placeholder*="email"], input[placeholder*="Email"]').first
        if email_input.is_visible():
            email_input.fill("test@martup.id")
            print("  Filled email")
    except:
        print("  No email input found")
    
    try:
        password_input = page.locator('input[type="password"]').first
        if password_input.is_visible():
            password_input.fill("Test1234!")
            print("  Filled password")
    except:
        print("  No password input found")
    
    # Instead of login, let's inject the auth state directly via the store
    print("\n--- Injecting auth state via store ---")
    result = page.evaluate("""() => {
        const store = window.__MARTUP_STORE__;
        if (!store) return { error: 'No store' };
        
        // Set user directly
        store.setState({
            currentUser: {
                id: 'test-user-001',
                name: 'Test User',
                email: 'test@martup.id',
                phone: '081234567890',
                role: 'buyer',
                avatar: null,
                isVerified: true,
                createdAt: new Date().toISOString()
            },
            isAuthenticated: true,
        });
        
        return { injected: true };
    }""")
    print(f"Auth injection result: {result}")
    
    # Navigate to checkout
    page.evaluate("""() => {
        const store = window.__MARTUP_STORE__;
        if (!store) return;
        
        // Add addresses
        store.setState({
            addresses: [{
                id: 'addr-1',
                userId: 'test-user-001',
                label: 'Rumah',
                recipient: 'Test User',
                phone: '081234567890',
                address: 'Jl. Sudirman No. 1',
                city: 'Jakarta',
                province: 'DKI Jakarta',
                postalCode: '10110',
                isDefault: true
            }],
            selectedAddressId: 'addr-1',
            walletBalance: 1000000,
        });
        
        // Add cart items using the cart store
        // The cart store is separate
    }""")
    
    # We need to also add items to the cart store
    page.evaluate("""() => {
        // Try to access cart store
        const cartStore = window.__MARTUP_CART_STORE__;
        if (cartStore) {
            cartStore.setState({
                items: [{
                    id: 'cart-1',
                    productId: 'prod-1',
                    product: {
                        id: 'prod-1',
                        name: 'Test Product 1',
                        price: 50000,
                        discountPrice: 45000,
                        images: [],
                        stock: 10,
                        sellerId: 'seller-1',
                        seller: { id: 'seller-1', storeName: 'Test Store', storeCity: 'Jakarta', isVerified: true },
                        weight: 500,
                        category: 'Elektronik'
                    },
                    quantity: 2,
                    checked: true
                }]
            });
        }
    }""")
    
    # Navigate to checkout
    page.evaluate("""() => {
        const store = window.__MARTUP_STORE__;
        if (!store) return;
        store.getState().navigate('checkout');
    }""")
    page.wait_for_timeout(3000)
    page.screenshot(path=os.path.join(SCREENSHOT_DIR, "checkout_injected.png"), full_page=True)
    print("✅ Checkout (injected) screenshot taken")
    
    # Check page text
    page_text = page.inner_text("body")
    print(f"\nPage text contains 'Transfer Bank': {'Transfer Bank' in page_text}")
    print(f"Page text contains 'Escrow': {'Escrow' in page_text}")
    print(f"Page text contains 'Rekening MartUp': {'Rekening MartUp' in page_text}")
    
    # Now let's check the actual source files via a different approach
    # Let's search for the payment method names in the JS bundle
    print("\n--- Searching JS bundles for payment method text ---")
    
    # Go to the checkout page's JavaScript module
    js_result = page.evaluate("""async () => {
        // Try to fetch the checkout shared module directly
        try {
            const res = await fetch('/api/db-status');
            return { dbStatus: await res.json() };
        } catch (e) {
            return { error: e.message };
        }
    }""")
    print(f"DB Status: {js_result}")
    
    # Let's just do a source code check via the API
    # Check payment/create API for Midtrans error message
    print("\n--- Testing payment/create API (unauthenticated) ---")
    api_result = page.evaluate("""async () => {
        try {
            const res = await fetch('/api/payment/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: 'test' })
            });
            return { status: res.status, body: await res.json() };
        } catch (e) {
            return { error: e.message };
        }
    }""")
    print(f"Payment create API (unauth): status={api_result.get('status')}, body={api_result.get('body', {})}")
    
    # Now let's test with an actual order flow
    # First, try to register/login through the API
    print("\n--- Testing order creation API ---")
    
    # Register a test user
    register_result = page.evaluate("""async () => {
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Test Buyer',
                    email: 'test-buyer-checkout@martup.id',
                    password: 'Test1234!',
                    phone: '081234567891'
                })
            });
            return { status: res.status, body: await res.json() };
        } catch (e) {
            return { error: e.message };
        }
    }""")
    print(f"Register result: status={register_result.get('status')}")
    
    # Login to get a token
    login_result = page.evaluate("""async () => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'test-buyer-checkout@martup.id',
                    password: 'Test1234!'
                })
            });
            const data = await res.json();
            return { status: res.status, token: data.data?.token, body: data };
        } catch (e) {
            return { error: e.message };
        }
    }""")
    print(f"Login result: status={login_result.get('status')}, has_token={bool(login_result.get('token'))}")
    
    token = login_result.get('token')
    
    if token:
        # Create an order with escrow payment method
        order_result = page.evaluate("""async (token) => {
            try {
                const res = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        userId: 'test-user',
                        sellerId: 'test-seller',
                        addressId: 'test-addr',
                        paymentMethod: 'Transfer Bank',
                        subtotal: 90000,
                        shippingCost: 10000,
                        totalAmount: 101000,
                        items: [{
                            productId: 'test-product',
                            quantity: 1,
                            price: 90000
                        }],
                        shipping: {
                            provider: 'JNE',
                            service: 'REG'
                        }
                    })
                });
                return { status: res.status, body: await res.json() };
            } catch (e) {
                return { error: e.message };
            }
        }""", token)
        print(f"Order creation: status={order_result.get('status')}")
        order_body = order_result.get('body', {})
        print(f"Order result: success={order_body.get('success')}, error={order_body.get('error', 'N/A')[:100]}")
        
        # Test payment/create API with auth
        payment_result = page.evaluate("""async (token) => {
            try {
                const res = await fetch('/api/payment/create', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ orderId: 'test-order-id' })
                });
                return { status: res.status, body: await res.json() };
            } catch (e) {
                return { error: e.message };
            }
        }""", token)
        payment_body = payment_result.get('body', {})
        print(f"\nPayment create (auth): status={payment_result.get('status')}")
        print(f"  success={payment_body.get('success')}")
        print(f"  error={payment_body.get('error', 'N/A')[:200]}")
        
        # Check if the Midtrans not configured message appears
        has_midtrans_msg = 'Pembayaran Midtrans belum dikonfigurasi' in str(payment_body.get('error', ''))
        print(f"  Has 'Pembayaran Midtrans belum dikonfigurasi': {has_midtrans_msg}")
    
    browser.close()

print("\n✅ Screenshots and API tests complete")
print(f"📸 Screenshots saved to {SCREENSHOT_DIR}")
