# Task 3: User Settings API Persistence

## Agent: User Settings API Persistence
## Date: 2026-03-04

### Summary
Implemented server-side persistence for user personal settings (twoFactor, pushNotif, emailNotif, dataSharing) so they survive cross-device logins.

### Changes Made

#### 1. Prisma Schema (`prisma/schema.prisma`)
- Added `UserSetting` model with fields: `id`, `userId`, `key`, `value`
- Added unique constraint on `[userId, key]` and index on `[userId]`
- Added `userSettings UserSetting[]` relation to the `User` model
- Ran `bun run db:push` successfully

#### 2. API Route (`src/app/api/user/settings/route.ts`)
- **GET /api/user/settings**: Authenticates user via `verifyAuth`, reads all UserSetting rows for the user, merges with defaults, returns flat object
- **PUT /api/user/settings**: Authenticates user, validates keys against allowed list, upserts each changed setting using `$transaction`, returns merged settings after update
- Default values: `{ twoFactor: false, pushNotif: true, emailNotif: true, dataSharing: false }`
- Follows same pattern as admin settings API

#### 3. Settings Slice (`src/lib/store/settings.ts`)
- Added `isSettingsLoaded` boolean flag
- Added `fetchSettings()` method that calls GET `/api/user/settings` and updates local state
- Modified `updateSettings()` to do optimistic local update + async server persist (PUT with CSRF token)
- On server persist failure, reverts to previous state

#### 4. Types (`src/lib/store/types.ts`)
- Added `isSettingsLoaded: boolean` to `SettingsSlice`
- Added `fetchSettings: () => Promise<void>` to `SettingsSlice`

#### 5. Data Sync (`src/lib/use-data-sync.ts`)
- Added `fetchSettings` to the `Promise.all` on login
- Added `isSettingsLoaded: false` reset on logout

#### 6. Store Partialize (`src/lib/store/index.ts`)
- Updated comment to clarify settings are persisted locally for fast UI but synced from server
- Explicitly noted `isSettingsLoaded` is NOT persisted

### Lint Results
- All lint checks pass cleanly with no errors

### Architecture Decisions
- Used per-user key-value store (`UserSetting`) rather than a JSON blob column, allowing efficient per-key upserts and future extensibility
- Optimistic local updates for snappy UI, with server sync in background
- Revert on server failure to maintain consistency
- CSRF token included on PUT requests via `getAuthHeaders(true)`
