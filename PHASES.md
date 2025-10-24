# FocusFlow — Project Phases

This document outlines the delivery phases for FocusFlow, aligned with the updated PRD v2.0 (2025‑10‑23) and our current implementation. iOS remains first priority. Local‑first continues by default; cloud sync is optional for signed‑in users.

## Phase 1 — Project Setup (Complete)
- Initialize Expo project (managed workflow)
- Configure navigation (stack)
- Baseline screens: Home, App Selection, Focus Session

## Phase 2 — App Blocking Bridge (Placeholder) (Complete for stubs)
- JS bridge `AppBlocker` with safe fallback
- Android native stubs + package registration
- iOS stub files (to be added to Xcode target when building)

## Phase 3 — Smart Reminders (Complete: Interval)
- Install `expo-notifications`
- Interval-based reminders with add/pause/delete and persistence

## Phase 4 — Data Persistence (Complete)
- AsyncStorage helpers (apps, reminders)
- Persist selections and reminders across restarts

## Phase 5 — UI/Theme Polish (Complete v1)
- Cohesive dark theme and styled buttons
- Consistent headers and surfaces

## Phase 6 — MVP Enhancements (Complete)
- Add daily-at-time reminders alongside interval ✅
- Android permissions CTAs (Usage Access, Accessibility) ✅
- Android installed apps list via native module (label + package) ✅
- Dashboard summary: session status and next reminder ✅
- Free limits + soft upsell (5 apps, 5 reminders) ✅
- Weekly reminders with day picker ✅
- Custom interval reminders ✅
- Reminder editing capabilities ✅
- UI/UX polish: search, bottom spacing, scroll behavior ✅

## Phase 7 — Guest User Experience (Complete — iOS Focus)
- Complete guest user flow per PRD Section 2.1 ✅
- Add "Sign In" button to Settings (replace current "Sign Out") ✅
- Create placeholder auth screens (Sign In/Sign Up) ✅
- Add upgrade prompts when users hit reminder/app limits ✅
- Polish premium upgrade messaging and CTAs (iOS-style Premium modal) ✅
- Implement functional Settings toggles (persisted) ✅
- Premium storage normalized (boolean with legacy support) ✅
- Home premium badge refresh on focus ✅
- Developer toggle to switch Premium/Free for testing ✅
- iOS-specific UX optimizations and native feel ✅

Remaining for Phase 7:
- None — Phase 7 complete for MVP scope

## Phase 8 — Authentication (Supabase) (Complete)
- Supabase email/password sign‑in and sign‑up ✅
- Password reset ✅
- Session persistence on app start ✅
- Auth tokens stored in iOS Keychain via Expo SecureStore ✅
- Settings reflects account state; Account screen (change password, sign out) ✅
- Migration prompt groundwork (guest → auth) with local flag ✅
- .env/.env.example, URL polyfill, and tests ✅

## Phase 9 — Cloud Sync & Data Migration (Next)
- Supabase schema and RLS policies for user data ✅ (sql added; applied externally)
- Enable gated migration upload (feature flag) ✅
- Implement cloud → local download and merge (latest‑wins with updated_at)
- One‑time guest → account migration flow (replace/merge option)
- Background sync on app focus (signed‑in only)
- Integration tests for upload/download/merge

## Phase 10 — Real App Blocking (MVP priority) (Implementation Deferred ⚠️)
- Native iOS module: request DeviceActivity authorization ✅
- iOS Family Controls integration and app restriction shields ✅
- Background app monitoring and enforcement (pending Apple approval)

**Status**: Implementation scaffolding complete but **production enforcement is deferred** pending Apple entitlement approval for Family Controls and Device Activity frameworks. The UI and development infrastructure are ready, but actual app blocking requires special approval from Apple that is not automatically granted.

- Dev builds can test the authorization flow and interface
- Production apps will need to request entitlements separately
- Current implementation allows full focus timer functionality without enforcement

Note: PRD v2.0 elevates "technically unbreakable blocking" to MVP. The app delivers core value (focus sessions, reminders, app selection) while blocking enforcement awaits approval.

## Phase 11 — Premium Features & IAP (Planned)
- Implement IAP subscriptions (StoreKit 2/RevenueCat)
- Entitlements cache and refresh
- Premium gating for unlimited reminders, advanced analytics, accountability
- Subscription management and restore purchases

## Phase 12 — Testing & Docs (Ongoing)
- Unit tests (utils, storage, scheduling helpers) ✅
- Premium storage normalization and gating tests ✅
- Integration tests for auth and premium flows
- README/usage docs and progress log ✅

## Phase 13 — Prebuild & Native Wiring (Ongoing)
- Keep prebuild up to date for native modules and plugins ✅
- iOS: add stub sources to Xcode target when building ✅

Notes
- PRD v2.0 specifies: Free tier limits (3 apps per session, 5 sessions/day, 5 reminders), basic analytics, minimalist dashboard. We keep local‑first UX; signed‑in users can sync.
- Real app blocking needs native implementations (DeviceActivity on iOS, UsageStats/Accessibility on Android) and entitlements. We will ship iOS strict‑mode first, then Android.

