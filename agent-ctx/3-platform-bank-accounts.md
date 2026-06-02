# Task 3 - Platform Bank Accounts Component

## Work Log

- Read worklog.md to understand previous work (Phase 1-3 refactoring, apiClient migrations, etc.)
- Read existing settings.tsx to understand visual style (amber-600 theme, rounded-xl cards, SectionHeader usage)
- Read API routes for bank accounts (GET/POST /api/admin/bank-accounts, PUT/DELETE /api/admin/bank-accounts/[id])
- Read Prisma schema for PlatformBankAccount model (id, bankName, bankCode, accountNumber, accountHolder, branch, isActive, isDefault, sortOrder, createdAt, updatedAt)
- Read shared component exports (SectionHeader from layout.tsx, fadeIn from animations.ts)
- Read api-client.ts for apiClient methods and ApiClientError class
- Read Select UI component to understand API for bank name dropdown

### Created: `/home/z/my-project/src/components/ecommerce/admin/platform-bank-accounts.tsx`
- "use client" directive
- Imports: motion/AnimatePresence from framer-motion, Building2/Plus/Pencil/Trash2/Star/Check/X from lucide-react, Button/Card/Input/Switch/Separator from @/components/ui/*, Select/SelectContent/SelectItem/SelectTrigger/SelectValue from @/components/ui/select, useAppStore from @/lib/store, apiClient/ApiClientError from @/lib/api-client, SectionHeader from ../shared, fadeIn from @/lib/animations
- PlatformBankAccount interface matching Prisma schema
- Type aliases: BankAccountListResponse, BankAccountMutationResponse (avoids TSX generic ambiguity)
- COMMON_BANKS constant: 10 Indonesian banks (BCA, Mandiri, BNI, BRI, BSI, CIMB, Danamon, Permata, OCBC, Panin) with codes and brand colors
- Helper functions: getBankColor(), getBankCode(), formatAccountNumber()
- BankAccountForm interface and emptyForm constant
- PlatformBankAccounts component with:
  - State: bankAccounts, loading, showForm, editingId, form, saving, deletingId
  - fetchBankAccounts() using apiClient.get
  - handleAdd/handleEdit/handleCancel for form management
  - handleSave() for create (POST) or update (PUT) with validation
  - handleSetDefault() - PUT with isDefault: true
  - handleToggleActive() - PUT with toggled isActive
  - handleDelete() - DELETE (soft-delete via API)
  - handleBankNameSelect() - auto-fills bank code when selecting from dropdown
  - Layout: SectionHeader with Building2 icon, "Tambah Rekening" button, AnimatePresence inline form, bank account list cards
  - Form: bank name Select dropdown, bank code Input, account number Input, account holder Input, branch Input, sort order Input, isDefault Switch, isActive Switch, Save/Cancel buttons
  - Cards: bank color indicator square, bank name, status badges (Default/Active/Inactive), formatted account number, account holder, branch, action buttons (Edit, Set Default, Toggle Active, Delete)
  - Loading/empty states with spinner and Building2 icon
  - Consistent amber-600 theme matching existing settings page

### Updated: `/home/z/my-project/src/components/ecommerce/admin/settings.tsx`
- Added import: `import { PlatformBankAccounts } from "./platform-bank-accounts"`
- Added `<PlatformBankAccounts />` BEFORE the "Keuangan" section

### Updated: `/home/z/my-project/src/components/ecommerce/admin/index.ts`
- Added export: `export { PlatformBankAccounts } from './platform-bank-accounts'`

### Verification
- Lint passes ✅
- Dev server compiles successfully ✅ (GET / 200)

## Stage Summary
- Created PlatformBankAccounts component with full CRUD functionality
- Inline add/edit form with AnimatePresence transitions
- 10 Indonesian bank presets with brand colors and codes
- Consistent amber-600 visual theme matching existing settings page
- All API calls use apiClient with ApiClientError handling
- Zero breaking changes — lint passes, dev server OK
