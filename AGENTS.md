This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Mobile UI & State Invariants

- **Safe Area Inset Rule**: Screens and modals must respect device top insets (status bar/clock area). Use `useSafeTopPadding` or `SafeAreaView` with proper edges (`['top']` or `AppTopBar`) to prevent interactive elements and buttons from being clipped or rendered underneath the status bar clock.
- **Optimistic State & RefreshControl Decoupling**: Never bind `RefreshControl`'s `refreshing` prop directly to background mutation states (`isLoading`). Decouple user-initiated pull-to-refresh (`isRefreshing`) from fast, optimistic micro-actions (e.g. water quick-add/decrement, food logs) to prevent screen jitter and UI flickering.
- **Context Memoization Invariant**: In React Context providers managing mutable store states with versioning (e.g., `WorkoutContext`), always include the state version/trigger in the `useMemo` dependency array to ensure consumer screens re-render immediately upon store mutations.

## Supabase Auth Roadmap (Pending)

- **Email Verification (Deferred)**: Currently, Supabase Auth is configured for immediate sign-up without mandatory email confirmation to keep mobile onboarding frictionless during initial development. Before production release, enable **Confirm email** in Supabase Auth, configure the deep-link redirect (`fitnessapp://` in `app.json`), and add a "verify your email" state/flow in `src/app/auth.tsx`.
