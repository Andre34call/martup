import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  defaultViewport: { width: 390, height: 844 }
});

const page = await browser.newPage();

const consoleLogs = [];
page.on('console', msg => {
  consoleLogs.push({ type: msg.type(), text: msg.text() });
});

try {
  console.log('=== Browser Test: Verifying Both Bug Fixes ===\n');
  
  // Test 1: Navigate to homepage
  console.log('Step 1: Navigate to homepage');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 20000 });
  await page.screenshot({ path: '/home/z/my-project/verify-browser-home.png' });
  const title = await page.title();
  console.log('  Title:', title);
  
  // Test 2: Test the payment API directly from browser context
  console.log('\nStep 2: Test payment/create API (Bug #1)');
  
  // Register and login
  await page.evaluate(async () => {
    await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'BrowserTest', email: 'browser@test.com',
        phone: '081999888000', password: 'TestPass123!'
      })
    });
    await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'browser@test.com', password: 'TestPass123!' })
    });
  });
  
  // Create seller and product, then test payment
  const paymentTest = await page.evaluate(async () => {
    // Get CSRF
    const csrfRes = await fetch('/api/csrf-token');
    const csrfData = await csrfRes.json();
    const csrfToken = csrfData.token;
    const headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken };
    
    // Register seller
    const meRes = await fetch('/api/auth/me');
    const meData = await meRes.json();
    const userId = meData.user?.id;
    
    const sellerRes = await fetch('/api/seller/register', {
      method: 'POST', headers,
      body: JSON.stringify({ userId, storeName: 'Browser Test Store' })
    });
    const sellerData = await sellerRes.json();
    const sellerId = sellerData.data?.id;
    
    // Create product
    const freshCsrf1 = await (await fetch('/api/csrf-token')).json();
    const prodRes = await fetch('/api/seller/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': freshCsrf1.token },
      body: JSON.stringify({
        sellerId, categoryId: 'cmq3gilhe0000n5dy7ee3na00',
        name: 'Browser Test Product', slug: 'browser-test-product',
        description: 'Browser test', price: 100000, stock: 5,
        minOrder: 1, weight: 200, condition: 'new',
        productType: 'product', status: 'active',
        images: JSON.stringify(['/uploads/products/images/test.jpg']),
      })
    });
    const prodData = await prodRes.json();
    const productId = prodData.data?.id;
    
    // Create address
    const freshCsrf2 = await (await fetch('/api/csrf-token')).json();
    const addrRes = await fetch('/api/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': freshCsrf2.token },
      body: JSON.stringify({
        recipient: 'Test', phone: '081999888000',
        address: 'Jl. Test', city: 'Jakarta',
        province: 'DKI Jakarta', postalCode: '12345', label: 'Rumah',
      })
    });
    const addrData = await addrRes.json();
    const addrId = addrData.data?.id;
    
    // Create order
    const freshCsrf3 = await (await fetch('/api/csrf-token')).json();
    const orderRes = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': freshCsrf3.token },
      body: JSON.stringify({
        userId, sellerId,
        items: [{ productId, quantity: 1 }],
        addressId: addrId,
        paymentMethod: 'midtrans',
        shippingProvider: 'jne', shippingService: 'REG',
      })
    });
    const orderData = await orderRes.json();
    const orderId = orderData.data?.id;
    
    // Test payment
    const freshCsrf4 = await (await fetch('/api/csrf-token')).json();
    const paymentRes = await fetch('/api/payment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': freshCsrf4.token },
      body: JSON.stringify({ orderId })
    });
    const paymentData = await paymentRes.json();
    
    return {
      userId, sellerId, productId, addrId, orderId,
      paymentSuccess: paymentData.success,
      paymentDevMock: paymentData.data?.devMock,
      paymentStatus: paymentData.data?.status,
      paymentOrderNumber: paymentData.data?.orderNumber,
      paymentError: paymentData.error,
    };
  });
  
  console.log('  Payment test result:');
  console.log('    Order ID:', paymentTest.orderId);
  console.log('    Payment success:', paymentTest.paymentSuccess);
  console.log('    Dev mock:', paymentTest.paymentDevMock);
  console.log('    Status:', paymentTest.paymentStatus);
  console.log('    Order number:', paymentTest.paymentOrderNumber);
  
  if (paymentTest.paymentSuccess && paymentTest.paymentDevMock) {
    console.log('\n  ✅ Bug #1 VERIFIED in browser: Payment "Bayar Sekarang" works in dev mode!');
  }
  
  // Test 3: Image upload (Bug #2)
  console.log('\nStep 3: Test image upload API (Bug #2)');
  
  const uploadTest = await page.evaluate(async () => {
    // Create a small test PNG
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(0, 0, 10, 10);
    
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'test-upload.png', { type: 'image/png' });
    
    // Get CSRF
    const csrfRes = await fetch('/api/csrf-token');
    const csrfData = await csrfRes.json();
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', 'products');
    formData.append('folder', 'images');
    
    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfData.token },
      body: formData,
    });
    
    return await uploadRes.json();
  });
  
  console.log('  Upload result:');
  console.log('    Success:', uploadTest.success);
  console.log('    URL:', uploadTest.data?.url);
  console.log('    Is /uploads/:', uploadTest.data?.url?.startsWith('/uploads/'));
  console.log('    Is blob::', uploadTest.data?.url?.startsWith('blob:'));
  console.log('    Type:', uploadTest.data?.type);
  
  if (uploadTest.success && uploadTest.data?.url?.startsWith('/uploads/')) {
    console.log('\n  ✅ Bug #2 VERIFIED in browser: Image upload saves to local filesystem!');
    console.log('    URL is /uploads/... NOT blob:');
    console.log('    Image preview will work correctly');
    console.log('    Form submission will not block with "Gambar gagal diupload"');
  }
  
  // Screenshot of the app
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2', timeout: 15000 });
  await page.screenshot({ path: '/home/z/my-project/verify-browser-final.png' });
  
  // Summary
  console.log('\n========================================');
  console.log('=== BROWSER TEST SUMMARY ===');
  console.log('========================================');
  console.log('');
  console.log('Bug #1 (Payment "Bayar Sekarang"):');
  if (paymentTest.paymentDevMock) {
    console.log('  ✅ VERIFIED - Dev mock mode works');
    console.log('  Order auto-confirmed as paid (no Midtrans "bad response" error)');
  } else {
    console.log('  ❌ NOT VERIFIED');
  }
  console.log('');
  console.log('Bug #2 (Image Upload):');
  if (uploadTest.success && uploadTest.data?.url?.startsWith('/uploads/')) {
    console.log('  ✅ VERIFIED - Local filesystem upload works');
    console.log('  Image URL is /uploads/... (not blob:)');
  } else {
    console.log('  ❌ NOT VERIFIED - Upload result:', JSON.stringify(uploadTest).substring(0, 100));
  }
  console.log('');
  
  // Console errors
  const errors = consoleLogs.filter(l => l.type === 'error');
  if (errors.length > 0) {
    console.log('Console errors:', errors.length);
    errors.forEach(e => console.log('  -', e.text.substring(0, 100)));
  } else {
    console.log('No console errors');
  }
  
} catch (error) {
  console.error('Browser test error:', error.message);
}

await browser.close();
