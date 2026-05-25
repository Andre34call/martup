---
Task ID: 1
Agent: Main
Task: Fix product image/video upload, products showing on homepage, and red asterisks for required fields

Work Log:
- Found critical bug: `fetchProducts` in store.ts was reading `data.products` but API returns `data.data` — products NEVER loaded from API
- Fixed `fetchProducts` to read from `data.data || data.products || []`
- Fixed `addProduct` to include `videoUrl` in POST body to `/api/seller/products`
- Added `videoUrl` mapping in `fetchProducts` product parser
- Created `/api/setup/storage` route to initialize Supabase Storage bucket with proper RLS policies
- The setup uses `pg` library with direct database URL for DDL operations (bucket creation + policy setup)
- Storage setup is called automatically from DataFetcher during app initialization
- Tested: Storage bucket creation works, file upload to Supabase works, public URL is accessible
- Added red asterisks (*) in red-500 color to all required field labels across:
  - seller-add-product-screen.tsx (Nama Produk, Kategori, Deskripsi, Harga Jual, Stok, Berat)
  - auth-screens.tsx (login form, register form, forgot password form)
  - seller-screens.tsx (store settings, bank info, campaign form, tracking number)
  - missing-screens.tsx (change password, address form, return/refund form)
- Added validation for description and weight in product submit handler
- Improved upload API with better error messages in Indonesian

Stage Summary:
- Products now load from API correctly (was `data.products`, now `data.data`)
- Supabase Storage bucket "products" auto-created with public read/upload policies
- Image/video uploads now work end-to-end
- videoUrl is properly persisted and fetched
- All required form fields have red asterisks
