---
name: react-native-expo-patterns
description: Three RN/Expo patterns burned in by MVP-01..03 in this repo (rcao-quiz). Read before touching apps/mobile/ or packages/sdk/src/components/.
---

Three rules. Each cites its precedent in this repo. Not aspirational —
every one was paid for by a bug on iPhone 16e / iOS 26.2 during MVP-03.

## 1. Layout-critical props go in `style={}`, not NativeWind classes

Anything load-bearing for layout — `flex`, width/height, `position:
'absolute'`, `top`/`left`/`right`/`bottom` — must be passed via
`style={...}`, not a NativeWind `className`. NativeWind is fine for
colour/typography/static styling; for layout, RN's measure pass needs to
see the value on first paint and NativeWind's class rewrite happens too
late on some Expo + iOS combos.

When it bites: rotation, dynamic content sizing, simulator resize, paging
scroll. Symptom in the wild: home-screen content pushed off-screen above
the visible area on iOS 26.2 (deprecated `SafeAreaView` + `flex:1` via
className). Precedent: commit `2e26276` (`fix(mvp-03): home screen +
QuestionCard layout on iOS 26.2`).

## 2. No function-as-style on `Pressable`

`Pressable` accepts `style={({ pressed }) => [...]}` per the RN docs, but
combining the function form with NativeWind className interop silently
drops the inline overrides on Expo + iOS 26.2 — only the static
`StyleSheet` ID applies, and per-state background/border vanish. Net
effect: invisible buttons, text only.

Pre-compute a plain style array (or use `useState` + `onPressIn` /
`onPressOut`) instead. Likely to recur in MVP-05's vertical pager — load-
bearing. Precedent: the `ChoiceButton` invisibility fix in commit
`2e26276`; see `packages/sdk/src/components/ChoiceButton.tsx:76-89` for
the comment block and the precomputed `buttonStyle` array still in place.

## 3. `useWindowDimensions()` over `Dimensions.get()` at module scope

Module-scope `Dimensions.get('window')` snapshots once at JS load and is
wrong after rotation, split-screen, or simulator resize.
`useWindowDimensions()` re-renders on change.

Precedent: `packages/sdk/src/components/QuestionCard.tsx:64` —
`const win = useWindowDimensions();` with the comment immediately above
explaining why `Dimensions.get('window')` was removed in commit
`2e26276`. Keep it that way.
