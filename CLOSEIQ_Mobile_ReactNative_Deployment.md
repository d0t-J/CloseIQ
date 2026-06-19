# CloseIQ — Mobile Application Development & Deployment (React Native)

## Executive Summary

This document is a focused guide for porting CloseIQ to a React Native mobile application and deploying it to app stores. It assumes the existing backend (LLM, embeddings, vector store, ASR integration) remains server-side and that the mobile client is a thin, secure, performant interface for live coaching.

Scope:

- React Native (TypeScript) implementation details
- Audio capture and streaming strategies for low-latency coaching
- Build, signing, and app store deployment (Android Play Store & iOS App Store)
- CI/CD using Expo EAS or Fastlane + GitHub Actions
- Security, privacy, testing, monitoring, and exam-focused Q&A

---

## Why React Native

- Code reuse: React Native allows reuse of UI patterns and TypeScript business logic from the web frontend.
- Ecosystem: strong libraries for navigation, native modules, and cloud services.
- Fast iteration: Expo managed workflow speeds development and provides EAS build & update tools.
- Portability: easier cross-platform parity compared to maintaining separate Swift/Kotlin codebases.

---

## Project Structure (recommended)

- `mobile/` — root of RN app
    - `src/`
        - `components/` — UI components
        - `screens/` — session screen, history, auth
        - `services/` — audio transport, session manager, backend API
        - `hooks/` — custom hooks (useSession, useAudioTransport)
        - `utils/` — helpers
    - `app.json` / `app.config.ts` (Expo) or native `android/`, `ios/` if bare
    - `package.json`

Keep native audio and transport logic inside `services/audioTransport.ts` (or a native module bridge) and expose an interface:

- `startSession(sessionId)`
- `stopSession()`
- `onTranscript(callback)`
- `onSuggestion(callback)`

This abstraction lets you swap WebSocket transport for WebRTC with minimal UI changes.

---

## Audio Capture & Streaming (recommended approach)

Options:

1. WebRTC (recommended)
    - Use `react-native-webrtc` to capture microphone, encode to Opus, and stream directly to a WebRTC-enabled ASR or to the backend via a SFU.
    - Pros: efficient Opus streaming, built-in packetization and jitter handling.
    - Cons: slightly more integration effort.

2. WebSocket PCM tunnel (fallback)
    - Capture raw PCM frames (16-bit, 16kHz or 48kHz) and send via secure WebSocket to backend `/ws/audio` which forwards to Deepgram or another ASR.
    - Pros: simpler to prototype.
    - Cons: higher bandwidth and you must implement framing, timestamps, and possibly Opus encoding for production.

Implementation notes:

- Use short frames (20–200ms) and attach monotonic timestamps.
- Mark frames with `role` metadata if capturing two channels or tagging speaker source.
- Ensure TLS/WSS is used for all transport.

Sample conceptual streaming flow (mobile):

```js
// audioTransport.js (conceptual)
const ws = new WebSocket(`${BACKEND_WSS_URL}/ws/audio?sessionId=${id}`);
// on audio frame:
// ws.send(frame); // frame is ArrayBuffer of PCM or encoded Opus packets
```

Server-side must reassemble frames, buffer minimal context, and forward to ASR or run local VAD/diarization as needed.

---

## React Native Implementation Considerations

Permissions:

- Android: request `RECORD_AUDIO`, add `android:usesPermission` in `AndroidManifest.xml` and handle runtime permission requests.
- iOS: add `NSMicrophoneUsageDescription` in `Info.plist`.

Background audio:

- For continuously listening in background, configure background modes (iOS) and foreground service (Android) with notification.
- Background listening increases complexity and App Store review scrutiny; prefer short interactive sessions while app is foregrounded.

Native modules & audio codecs:

- Prefer WebRTC to avoid building Opus encoders. If building native modules, isolate them and add fallback JS paths for Expo-managed flow.

Config & secrets:

- Never store provider keys on the mobile app. Use ephemeral tokens: client requests an ephemeral ASR token from your backend (authenticated) that expires quickly.
- Use `expo-secure-store` or `react-native-keychain` to persist refresh tokens.

Offline support & sync:

- Persist transcripts and events in SQLite and sync when online.
- Provide an explicit "Upload when on Wi-Fi" toggle to avoid data charges.

---

## Backend Integration & APIs

Key endpoints and behaviors your mobile client will rely on:

- `POST /api/sessions` — create a new session (returns `sessionId`)
- `ws:// /ws/audio?sessionId=` — WebSocket to stream audio frames
- `POST /api/sessions/{id}/stop` — close session and trigger finalization/embedding
- `POST /api/query` — ad-hoc retrieve + LLM query (for non-streaming use)
- `GET /api/sessions/{id}/history` — fetch saved transcripts and suggestions

Design considerations:

- Use session-scoped caches on the backend to keep recent retrievals for the session.
- Rate limit query endpoints to prevent abuse.

---

## Deployment: Build, Sign, and Publish

Two main workflows: Expo managed (EAS) or Bare RN (Fastlane/Xcode/Gradle).

1. Expo + EAS (recommended for speed)

- Configure `app.json` and `eas.json`.
- Use `eas build --platform all` to create signed artifacts (APK/AAB and iOS .ipa).
- Use `eas submit` to upload to Play Store and App Store, or use `eas build` + manual upload.
- Use EAS Update (OTA) for pushing JS updates without rebuilds.

Quick commands:

```bash
npm install -g eas-cli
eas login
eas build --platform android
eas build --platform ios
eas submit --platform android --path /path/to/aab
eas submit --platform ios --path /path/to/ipa
```

Notes: EAS handles credentials or you can provide your own keystores and provisioning profiles.

2. Bare RN + Fastlane (more control)

- Android: `./gradlew bundleRelease` to produce an AAB. Sign with keystore; upload via Google Play Console or `fastlane supply`.
- iOS: build in Xcode or use `fastlane gym` and `pilot`/`deliver` for TestFlight/App Store.

Sample GitHub Actions (idea): run `eas build` in a workflow, then `eas submit` on `main` tag.

---

## CI/CD & Release Strategy

Recommended CI pipeline (GitHub Actions):

- `push` to `main` branch → run tests → `eas build` for staging → upload to internal test track (Play) / TestFlight.
- `tag` release → `eas build --profile production` → `eas submit` to stores.

Security: store `EAS_TOKEN`, `EXPO_TOKEN`, and Play/App Store service account secrets in GitHub Secrets.

Fastlane alternative (bare): use `fastlane` lanes to build and upload; store keystore and provisioning via secure storage or `match`.

---

## App Signing & Store Requirements

Android

- Create a release keystore (`.jks`), configure `gradle.properties` to use keystore passwords from CI secrets.
- Upload AAB to Google Play and configure internal test track for quick feedback.

iOS

- Enroll in Apple Developer Program.
- Configure App ID, provisioning profiles, and App Store Connect record.
- Use Xcode or Fastlane to produce signed `.ipa` and submit via TestFlight.

Common checks before submission

- App icons, splash screens, privacy policy URL, microphone usage string, and secure transport (HTTPS) for API endpoints.
- Provide demo credentials or a demo mode to reviewers so they can inspect functionality without signing up.

---

## OTA Updates & Hotfixes

- Expo EAS Update (recommended): push JS bundle updates without a full store rebuild.
- CodePush (App Center) alternative for bare RN.
- Use semantic channels (staging/prod) and pin builds to ensure compatibility between native binaries and JS runtime.

---

## Testing & QA

Unit & Component Tests

- `jest` + `react-native-testing-library` for component tests.

E2E

- Detox (recommended for RN) or Appium for cross-platform E2E testing.
- Create repeatable test scenarios: start session, stream pre-recorded audio, assert suggestion appears.

Manual

- Use TestFlight and Play Store internal test tracks for real-device validation.

Performance

- Measure CPU, memory, battery draw during long sessions and test on low-end devices.

---

## Observability & Monitoring

- Crash + error tracking: Sentry React Native.
- Analytics: Amplitude, Mixpanel, or Firebase Analytics.
- Backend metrics: Prometheus/Grafana for ASR/LLM latency and cost metrics.

---

## Security & Privacy (mobile-specific)

- Ephemeral tokens: issue ephemeral ASR tokens via backend so the mobile app never holds long-lived provider keys.
- Secure storage: use `expo-secure-store` or `react-native-keychain` for tokens.
- Data minimization: allow configuring transcript retention and automatic deletion.
- Privacy policy: link clearly in app metadata and onboarding.

---

## Deployment Checklist (quick)

- [ ] Configure `app.json` / `AndroidManifest.xml` / `Info.plist` for microphone usage strings
- [ ] Implement ephemeral token flow for ASR
- [ ] Configure EAS or Fastlane credentials and CI secrets
- [ ] Add privacy policy URL to store metadata
- [ ] Test on physical Android & iOS devices
- [ ] Create internal test track (Play) and TestFlight build (App Store)
- [ ] Verify background/foreground behavior and battery usage
- [ ] Ensure secure transport (HTTPS/WSS) for all endpoints

---

## Practical Exam Q&A (React Native-focused)

Q: Why choose Expo/EAS for this project?
A: Expo/EAS shortens build iteration time, handles credentials, and provides OTA updates. It's ideal for prototypes and school projects where speed matters.

Q: How to handle microphone permission for iOS vs Android?
A: Add `NSMicrophoneUsageDescription` to `Info.plist` and handle runtime `RECORD_AUDIO` permission on Android using `PermissionsAndroid` API.

Q: How will mobile authenticate to backend securely?
A: Use Supabase Auth for user flow and issue ephemeral ASR tokens for sessions. Persist refresh tokens in SecureStore and exchange them server-side for long-lived sessions.

Q: How to test real-time streaming reliably for demos?
A: Use pre-recorded audio files played into the device speaker in a quiet room, or simulate audio frames in an automated E2E test (Detox) to ensure repeatability.

Q: How to push quick fixes after release?
A: Use EAS Update (Expo) or CodePush for JS bundle fixes; native fixes require a new binary and store resubmission.

---

## Repo Links & Next Steps

- Read: [SERVICE_SETUP.md](SERVICE_SETUP.md)
- Backend entry: [backend/app/main.py](backend/app/main.py#L1)
- Example routers: [backend/app/routers/file_routes.py](backend/app/routers/file_routes.py#L1)

Next steps I can implement for you (pick one):

- Scaffold `mobile/` React Native + Expo starter with `audioTransport` service and a demo screen.
- Implement a FastAPI `/ws/audio` forwarding route and a small worker that forwards to Deepgram.
- Create GitHub Actions workflow for `eas build` + `eas submit`.

Tell me which to do next and I'll add it to the plan and start coding.
