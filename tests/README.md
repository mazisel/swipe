The current 33-test suite uses isolated in-memory PostgreSQL/PGlite with pgvector and temporary upload folders. `node:test` runs cases in source order so later cases can exercise accounts and products created earlier in the lifecycle. Store profile updates are restricted to the authenticated owner; public profiles exclude private account fields.

Manual browser checks (6 October 2026):

- Direct discovery without login; full-screen feed without a top bar; search and category filters under the bottom navigation.
- 390 × 844 mobile viewport: size selection → cart → registration → acknowledged demo checkout → order history.
- Seller account → shop → PNG file chooser upload → publish → item in discovery.
- Video readyState 4, playback advancing, pause control stops playback.
- Desktop viewport layout and next/previous feed controls.

Reels/glass revision checks:

- 390 × 844 mobile feed, floating glass navigation, product bottom panel, size selection and add-to-bag.
- Search for Form returns matching products; buyer profile has no seller management entry.
- Separate web Studio registration, store creation, store name/bio update and logout.
- Typecheck, lint, all 11 API tests, Expo Doctor 21/21 and iOS/Android/web exports pass. Physical-device/simulator execution and native Liquid Glass rendering remain unverified.

Only agent-created UI test records were removed after verification. Seed catalogue stays available; no hardcoded test login is shipped.

Social features (6 October 2026):

- Comment submission and own-comment deletion; empty/oversized text and forged identity rejected.
- Reviews require an order, reject seller self-rating, update one review per product/user, and label demo orders honestly.
- DM membership checks on read, send, and read-receipt endpoints; deduplicated retries; isolated buyer and seller inboxes.
- Mobile UI: login returns to comments, submit comment, select 4 stars, save demo review, send product-context DM.
- Web Studio: receive unread DM, open it and reply; buyer inbox then shows the unread response and full conversation.
- Only temporary agent-created social test accounts, product, upload, messages, reviews and comments are removed after verification. The DM screenshots use clearly labeled UI test records.

Native simulator smoke check (6 October 2026): iPhone 18 Pro / iOS 27, Expo Go SDK 57. App launches, fetches the local API catalogue and renders the Reels feed with glass navigation. Screenshot: `docs/screenshots/ios-simulator.png`. Other native flows and physical devices are not yet tested. Node IPv4-first was required for the local Expo server.

Discovery implementation (6 October 2026): see `docs/DISCOVERY.md`. New tests cover owned/idempotent pagination, behavioral caps, negative feedback, generation reset, guest/account merge, personalization divergence, actual-playback clocks, atomic AI budget admission, cached/malformed/timed-out AI jobs and SQLite migration backup/dry-run/parity. Live Supabase/Gemini remain unconfigured. Native exports do not establish Android runtime behavior.

Discovery native smoke: iPhone 18 Pro / iOS 27 with Expo Go, current feed and options control visible after a clean Expo Go restart. `docs/screenshots/discovery-ios.png`. New web controls: `docs/screenshots/discovery-controls.png`. Web/native telemetry reached PostgreSQL.
