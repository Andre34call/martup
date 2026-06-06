#!/usr/bin/env python3
"""Verify checkout flow fixes for MartUp e-commerce app."""

import json
import time
import os
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3000"
SCREENSHOT_DIR = "/home/z/my-project/test-screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

results = {
    "1_transfer_bank_text": {},
    "2_bank_transfer_checkout_flow": {},
    "3_midtrans_not_configured": {},
    "4_order_detail_bank_transfer": {},
}

def screenshot(page, name):
    path = os.path.join(SCREENSHOT_DIR, name)
    page.screenshot(path=path, full_page=True)
    print(f"  📸 Screenshot: {path}")
    return path

def inject_auth(page):
    """Inject auth state to bypass login."""
    page.evaluate("""() => {
        // Set a mock user in localStorage to bypass auth
        const mockUser = {
            id: 'test-user-001',
            name: 'Test User',
            email: 'test@martup.id',
            phone: '081234567890',
            role: 'buyer',
            avatar: null,
            isVerified: true,
            createdAt: new Date().toISOString()
        };
        
        // Try setting Zustand persisted state
        const state = {
            state: {
                currentUser: mockUser,
                isAuthenticated: true,
                currentScreen: 'home',
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
            },
            version: 0
        };
        localStorage.setItem('martup-storage', JSON.stringify(state));
    }""")

def navigate_to_checkout(page):
    """Navigate to checkout screen via app navigation."""
    # Try navigating directly by setting screen state
    page.evaluate("""() => {
        const stored = localStorage.getItem('martup-storage');
        if (stored) {
            const data = JSON.parse(stored);
            data.state.currentScreen = 'checkout';
            localStorage.setItem('martup-storage', JSON.stringify(data));
        }
    }""")
    page.reload()
    page.wait_for_timeout(2000)

def navigate_to_screen(page, screen_name):
    """Navigate to a specific screen by setting state."""
    page.evaluate(f"""() => {{
        const stored = localStorage.getItem('martup-storage');
        if (stored) {{
            const data = JSON.parse(stored);
            data.state.currentScreen = '{screen_name}';
            localStorage.setItem('martup-storage', JSON.stringify(data));
        }}
    }}""")
    page.reload()
    page.wait_for_timeout(2000)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
    context = browser.new_context(
        viewport={'width': 390, 'height': 844},
        device_scale_factor=2
    )
    page = context.new_page()
    
    # Capture console logs
    console_logs = []
    page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
    
    # ==================================================================
    # TEST 1: Verify "Transfer Bank" text (no "(Escrow)")
    # ==================================================================
    print("\n" + "="*60)
    print("TEST 1: Verify 'Transfer Bank' payment method text")
    print("="*60)
    
    page.goto(BASE_URL)
    page.wait_for_timeout(2000)
    
    # Inject auth and cart items to get to checkout
    page.evaluate("""() => {
        const mockUser = {
            id: 'test-user-001',
            name: 'Test User',
            email: 'test@martup.id',
            phone: '081234567890',
            role: 'buyer',
            avatar: null,
            isVerified: true,
            createdAt: new Date().toISOString()
        };
        
        const state = {
            state: {
                currentUser: mockUser,
                isAuthenticated: true,
                currentScreen: 'checkout',
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
                cartItems: [{
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
                        weight: 500
                    },
                    quantity: 2,
                    checked: true
                }],
            },
            version: 0
        };
        localStorage.setItem('martup-storage', JSON.stringify(state));
    }""")
    page.reload()
    page.wait_for_timeout(3000)
    screenshot(page, "checkout_page.png")
    
    # Check for "Transfer Bank" text
    page_text = page.inner_text("body")
    
    has_transfer_bank = "Transfer Bank" in page_text
    has_escrow_text = "Transfer Bank (Escrow)" in page_text
    has_escrow_parens = "(Escrow)" in page_text
    
    print(f"  ✅ 'Transfer Bank' found: {has_transfer_bank}")
    print(f"  ❌ 'Transfer Bank (Escrow)' found: {has_escrow_text}")
    print(f"  ❌ '(Escrow)' found anywhere: {has_escrow_parens}")
    
    # Check the specific payment method elements
    try:
        payment_methods = page.locator("text=Transfer Bank").all()
        for i, pm in enumerate(payment_methods):
            text = pm.inner_text()
            print(f"  Payment method element {i}: '{text}'")
    except Exception as e:
        print(f"  Could not find payment method elements: {e}")
    
    # Check for "Rekening MartUp" vs "Rekening Escrow MartUp"
    has_rekening_martup = "Rekening MartUp" in page_text
    has_rekening_escrow = "Rekening Escrow MartUp" in page_text
    print(f"  'Rekening MartUp' found: {has_rekening_martup}")
    print(f"  'Rekening Escrow MartUp' found: {has_rekening_escrow}")
    
    results["1_transfer_bank_text"] = {
        "has_transfer_bank": has_transfer_bank,
        "has_escrow_parens_in_payment": has_escrow_text,
        "has_escrow_parens_anywhere": has_escrow_parens,
        "has_rekening_martup": has_rekening_martup,
        "has_rekening_escrow": has_rekening_escrow,
        "PASS": has_transfer_bank and not has_escrow_text,
    }
    
    # ==================================================================
    # TEST 2: Check source code for payment method definitions
    # ==================================================================
    print("\n" + "="*60)
    print("TEST 2: Source code analysis for checkout flow")
    print("="*60)
    
    # Read the shared.tsx to verify payment method name
    with open("/home/z/my-project/src/components/ecommerce/checkout/shared.tsx", "r") as f:
        shared_content = f.read()
    
    # Check payment method name
    has_correct_name = 'name: "Transfer Bank"' in shared_content
    has_wrong_name = 'name: "Transfer Bank (Escrow)"' in shared_content
    
    print(f"  shared.tsx has 'name: \"Transfer Bank\"': {has_correct_name}")
    print(f"  shared.tsx has 'name: \"Transfer Bank (Escrow)\"': {has_wrong_name}")
    
    # Check checkout-screen.tsx for escrow flow
    with open("/home/z/my-project/src/components/ecommerce/checkout/checkout-screen.tsx", "r") as f:
        checkout_content = f.read()
    
    # Check: cart items removed AFTER order creation for escrow
    escrow_section = checkout_content[checkout_content.find("selectedPayment === 'escrow'"):]
    escrow_section_short = escrow_section[:500]
    
    cart_removed_after_order = "removeItem" in escrow_section_short
    navigates_to_orders = "navigate('orders')" in escrow_section_short
    navigates_to_order_tracking = "navigate('order-tracking')" in escrow_section_short
    
    print(f"  Escrow flow: cart items removed: {cart_removed_after_order}")
    print(f"  Escrow flow: navigates to 'orders': {navigates_to_orders}")
    print(f"  Escrow flow: navigates to 'order-tracking': {navigates_to_order_tracking}")
    
    # Check: if order creation fails, error toast shown
    has_gagal_toast = "Gagal membuat pesanan" in checkout_content
    
    # Check if escrow flow handles empty createdOrders
    escrow_handles_failure = "createdOrders.length" in escrow_section[:1000]
    
    print(f"  'Gagal membuat pesanan' toast found: {has_gagal_toast}")
    print(f"  Escrow flow checks createdOrders: {escrow_handles_failure}")
    
    # Check payment-step.tsx for "Rekening MartUp" vs "Rekening Escrow MartUp"
    with open("/home/z/my-project/src/components/ecommerce/checkout/payment-step.tsx", "r") as f:
        payment_step_content = f.read()
    
    has_rekening_martup_checkout = "Rekening MartUp" in payment_step_content
    has_rekening_escrow_checkout = "Rekening Escrow MartUp" in payment_step_content
    
    print(f"  payment-step.tsx has 'Rekening MartUp': {has_rekening_martup_checkout}")
    print(f"  payment-step.tsx has 'Rekening Escrow MartUp': {has_rekening_escrow_checkout}")
    
    results["2_bank_transfer_checkout_flow"] = {
        "payment_method_name_correct": has_correct_name,
        "payment_method_name_no_escrow": not has_wrong_name,
        "cart_removed_after_order": cart_removed_after_order,
        "navigates_to_orders": navigates_to_orders,
        "navigates_to_order_tracking": navigates_to_order_tracking,
        "has_gagal_toast": has_gagal_toast,
        "escrow_checks_created_orders": escrow_handles_failure,
        "rekening_martup_in_checkout": has_rekening_martup_checkout,
        "rekening_escrow_in_checkout": has_rekening_escrow_checkout,
    }
    
    # ==================================================================
    # TEST 3: Verify Midtrans not configured error
    # ==================================================================
    print("\n" + "="*60)
    print("TEST 3: Verify Midtrans not configured error message")
    print("="*60)
    
    # Check the payment create API route
    with open("/home/z/my-project/src/app/api/payment/create/route.ts", "r") as f:
        payment_create_content = f.read()
    
    has_midtrans_not_configured = "Pembayaran Midtrans belum dikonfigurasi" in payment_create_content
    has_correct_error_msg = "Silakan gunakan metode Transfer Bank atau hubungi admin" in payment_create_content
    has_503_status = "503" in payment_create_content
    
    print(f"  API has 'Pembayaran Midtrans belum dikonfigurasi': {has_midtrans_not_configured}")
    print(f"  API has full error message: {has_correct_error_msg}")
    print(f"  API returns 503 status: {has_503_status}")
    
    # Check if checkout screen handles this error from the API
    # Look at the midtrans/card payment section
    midtrans_section = checkout_content[checkout_content.find("selectedPayment === 'midtrans'"):]
    midtrans_section_short = midtrans_section[:3000]
    
    # Check if payment create error message is displayed as toast
    shows_midtrans_error_toast = False
    # Look for the pattern where paymentData.success is false and error is shown
    if "paymentData.error" in midtrans_section_short or "result?.error" in midtrans_section_short:
        shows_midtrans_error_toast = True
    
    # Check if there's a toast for when payment fails (no token)
    has_payment_failure_toast = any(
        msg in midtrans_section_short 
        for msg in ["Terjadi kesalahan saat memproses pembayaran", "Gagal memproses pembayaran", "Pembayaran Midtrans"]
    )
    
    print(f"  Checkout shows API error as toast: {shows_midtrans_error_toast}")
    print(f"  Checkout has payment failure toast: {has_payment_failure_toast}")
    
    # Try the API endpoint directly
    try:
        # First, get a session cookie by logging in
        api_response = page.evaluate("""async () => {
            try {
                const res = await fetch('/api/payment/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: 'test-order-id' })
                });
                const data = await res.json();
                return { status: res.status, data };
            } catch (e) {
                return { error: e.message };
            }
        }""")
        print(f"  API direct test: status={api_response.get('status')}, data={json.dumps(api_response.get('data', {}), ensure_ascii=False)[:200]}")
    except Exception as e:
        print(f"  API direct test failed: {e}")
    
    results["3_midtrans_not_configured"] = {
        "api_has_error_message": has_midtrans_not_configured,
        "api_has_full_message": has_correct_error_msg,
        "api_returns_503": has_503_status,
        "checkout_shows_api_error": shows_midtrans_error_toast,
    }
    
    # ==================================================================
    # TEST 4: Verify Order detail page for bank_transfer orders
    # ==================================================================
    print("\n" + "="*60)
    print("TEST 4: Verify Order detail page for bank_transfer orders")
    print("="*60)
    
    with open("/home/z/my-project/src/components/ecommerce/order-screen.tsx", "r") as f:
        order_screen_content = f.read()
    
    # Check "Pembayaran Transfer" vs "Pembayaran Escrow"
    has_pembayaran_transfer = "Pembayaran Transfer" in order_screen_content
    has_pembayaran_escrow = "Pembayaran Escrow" in order_screen_content
    
    print(f"  'Pembayaran Transfer' found: {has_pembayaran_transfer}")
    print(f"  'Pembayaran Escrow' found: {has_pembayaran_escrow}")
    
    # Check "Bayar Sekarang" button hidden for bank_transfer
    # The key is: `order.status === "pending" && !isEscrowOrder` for Bayar Sekarang
    bayar_sekarang_section = order_screen_content[order_screen_content.find("Bayar Sekarang"):]
    
    # Find the condition under which "Bayar Sekarang" appears
    # Look backward from the "Bayar Sekarang" button for the condition
    is_escrow_check_near_bayar = "!isEscrowOrder" in order_screen_content
    
    # Specifically check that the Bayar Sekarang button at line ~1270 has !isEscrowOrder condition
    # Find the action button section
    action_section = order_screen_content[order_screen_content.find("Action Button"):]
    action_section_short = action_section[:2000]
    
    bayar_sekarang_hidden_for_escrow = "!isEscrowOrder" in action_section_short
    print(f"  'Bayar Sekarang' hidden for escrow orders (!isEscrowOrder guard): {bayar_sekarang_hidden_for_escrow}")
    
    # Check "Upload Bukti Transfer" button visible for bank_transfer
    has_upload_bukti = "Upload Bukti Transfer" in order_screen_content
    print(f"  'Upload Bukti Transfer' found: {has_upload_bukti}")
    
    # Check bank account info shown
    has_bank_account_info = "escrowBankAccounts" in order_screen_content
    has_rekening_tujuan = "Rekening Tujuan" in order_screen_content
    print(f"  Bank account info fetched: {has_bank_account_info}")
    print(f"  'Rekening Tujuan' label found: {has_rekening_tujuan}")
    
    # Check isEscrowOrder definition
    is_escrow_order_def = "isEscrowOrder" in order_screen_content
    is_escrow_includes_escrow = "'escrow'" in order_screen_content and "isEscrowOrder" in order_screen_content
    is_escrow_includes_bank_transfer = "'bank_transfer'" in order_screen_content and "isEscrowOrder" in order_screen_content
    print(f"  isEscrowOrder defined: {is_escrow_order_def}")
    print(f"  isEscrowOrder includes 'escrow': {is_escrow_includes_escrow}")
    print(f"  isEscrowOrder includes 'bank_transfer': {is_escrow_includes_bank_transfer}")
    
    results["4_order_detail_bank_transfer"] = {
        "has_pembayaran_transfer": has_pembayaran_transfer,
        "has_pembayaran_escrow": has_pembayaran_escrow,
        "bayar_sekarang_hidden_for_escrow": bayar_sekarang_hidden_for_escrow,
        "has_upload_bukti": has_upload_bukti,
        "has_bank_account_info": has_bank_account_info,
        "has_rekening_tujuan": has_rekening_tujuan,
        "is_escrow_order_includes_escrow": is_escrow_includes_escrow,
        "is_escrow_order_includes_bank_transfer": is_escrow_includes_bank_transfer,
    }
    
    # ==================================================================
    # Navigate to order screen and check UI
    # ==================================================================
    print("\n" + "="*60)
    print("BONUS: Navigate to order screen with mock escrow order")
    print("="*60)
    
    # Set up mock order data and navigate
    page.evaluate("""() => {
        const mockUser = {
            id: 'test-user-001',
            name: 'Test User',
            email: 'test@martup.id',
            phone: '081234567890',
            role: 'buyer',
            avatar: null,
            isVerified: true,
            createdAt: new Date().toISOString()
        };
        
        const mockOrder = {
            id: 'order-001',
            orderNumber: 'ORD-12345',
            userId: 'test-user-001',
            sellerId: 'seller-1',
            status: 'pending',
            subtotal: 90000,
            shippingCost: 10000,
            discountAmount: 0,
            taxAmount: 0,
            platformFee: 1000,
            totalAmount: 101000,
            paymentMethod: 'Transfer Bank',
            paymentStatus: 'unpaid',
            items: [{
                id: 'oi-1',
                productId: 'prod-1',
                productName: 'Test Product',
                variantName: null,
                price: 45000,
                quantity: 2,
                subtotal: 90000,
                image: null
            }],
            shipping: {
                id: 'sh-1',
                provider: 'JNE',
                service: 'REG',
                estimatedDays: '2-3',
                status: 'pending'
            },
            address: {
                id: 'addr-1',
                recipient: 'Test User',
                phone: '081234567890',
                address: 'Jl. Sudirman No. 1',
                city: 'Jakarta',
                province: 'DKI Jakarta',
                postalCode: '10110',
                label: 'Rumah'
            },
            seller: {
                id: 'seller-1',
                storeName: 'Test Store',
                storeCity: 'Jakarta',
                isVerified: true
            },
            createdAt: new Date().toISOString()
        };
        
        const state = {
            state: {
                currentUser: mockUser,
                isAuthenticated: true,
                currentScreen: 'orders',
                selectedOrderId: 'order-001',
                orders: [mockOrder],
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
            },
            version: 0
        };
        localStorage.setItem('martup-storage', JSON.stringify(state));
    }""")
    page.reload()
    page.wait_for_timeout(3000)
    screenshot(page, "orders_page.png")
    
    orders_text = page.inner_text("body")
    print(f"  Orders page shows 'Transfer Bank': {'Transfer Bank' in orders_text}")
    print(f"  Orders page shows 'Bayar' button: {'Bayar' in orders_text}")
    
    # Click on the order to see detail
    try:
        order_card = page.locator("[class*='rounded-xl'][class*='border'][class*='cursor-pointer']").first
        if order_card.is_visible():
            order_card.click()
            page.wait_for_timeout(2000)
            screenshot(page, "order_detail_escrow.png")
            
            detail_text = page.inner_text("body")
            print(f"  Order detail shows 'Pembayaran Transfer': {'Pembayaran Transfer' in detail_text}")
            print(f"  Order detail shows 'Pembayaran Escrow': {'Pembayaran Escrow' in detail_text}")
            print(f"  Order detail shows 'Bayar Sekarang': {'Bayar Sekarang' in detail_text}")
            print(f"  Order detail shows 'Upload Bukti Transfer': {'Upload Bukti Transfer' in detail_text}")
            print(f"  Order detail shows 'Rekening': {'Rekening' in detail_text}")
            print(f"  Order detail shows 'Batalkan Pesanan': {'Batalkan Pesanan' in detail_text}")
            
            results["4_order_detail_bank_transfer"]["ui_pembayaran_transfer"] = "Pembayaran Transfer" in detail_text
            results["4_order_detail_bank_transfer"]["ui_pembayaran_escrow"] = "Pembayaran Escrow" in detail_text
            results["4_order_detail_bank_transfer"]["ui_bayar_sekarang_hidden"] = "Bayar Sekarang" not in detail_text
            results["4_order_detail_bank_transfer"]["ui_upload_bukti_visible"] = "Upload Bukti Transfer" in detail_text
            results["4_order_detail_bank_transfer"]["ui_rekening_visible"] = "Rekening" in detail_text
    except Exception as e:
        print(f"  Could not click order card: {e}")
    
    browser.close()

# ==================================================================
# Print Summary
# ==================================================================
print("\n" + "="*60)
print("VERIFICATION SUMMARY")
print("="*60)

for test_name, test_results in results.items():
    print(f"\n📋 {test_name}:")
    if isinstance(test_results, dict):
        for key, value in test_results.items():
            if key == "PASS":
                icon = "✅" if value else "❌"
                print(f"  {icon} {key}: {value}")
            elif isinstance(value, bool):
                icon = "✅" if value else "❌"
                print(f"  {icon} {key}: {value}")
            else:
                print(f"  ℹ️  {key}: {value}")

# Identify issues
print("\n" + "="*60)
print("ISSUES FOUND")
print("="*60)

issues = []

# Test 1: Transfer Bank text
if not results["1_transfer_bank_text"].get("PASS", False):
    issues.append("❌ 'Transfer Bank (Escrow)' text still present in payment method")

# Test 2: Checkout flow
if not results["2_bank_transfer_checkout_flow"].get("navigates_to_order_tracking", False):
    if results["2_bank_transfer_checkout_flow"].get("navigates_to_orders", False):
        issues.append("⚠️  Escrow checkout navigates to 'orders' list instead of 'order-tracking' (order detail) page")
    else:
        issues.append("❌ Escrow checkout doesn't navigate to orders or order-tracking page")

if not results["2_bank_transfer_checkout_flow"].get("escrow_checks_created_orders", False):
    issues.append("❌ Escrow flow doesn't check if orders were created before removing cart items")

# Test 3: Midtrans error
if not results["3_midtrans_not_configured"].get("api_has_full_message", False):
    issues.append("❌ API doesn't have the correct Midtrans not configured error message")

if not results["3_midtrans_not_configured"].get("checkout_shows_api_error", False):
    issues.append("❌ Checkout doesn't show Midtrans API error as toast notification")

# Test 4: Order detail
if not results["4_order_detail_bank_transfer"].get("has_pembayaran_transfer", False):
    issues.append("❌ Order detail shows 'Pembayaran Escrow' instead of 'Pembayaran Transfer'")

if results["4_order_detail_bank_transfer"].get("has_pembayaran_escrow", False):
    issues.append("⚠️  Order detail still contains 'Pembayaran Escrow' text")

if not results["4_order_detail_bank_transfer"].get("bayar_sekarang_hidden_for_escrow", False):
    issues.append("❌ 'Bayar Sekarang' button not hidden for bank_transfer orders")

if not results["4_order_detail_bank_transfer"].get("has_upload_bukti", False):
    issues.append("❌ 'Upload Bukti Transfer' button not present for bank_transfer orders")

if not issues:
    print("✅ No issues found! All fixes verified.")
else:
    for issue in issues:
        print(f"  {issue}")

# Save results
with open(os.path.join(SCREENSHOT_DIR, "checkout-fix-verification.json"), "w") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print(f"\nResults saved to {SCREENSHOT_DIR}/checkout-fix-verification.json")
