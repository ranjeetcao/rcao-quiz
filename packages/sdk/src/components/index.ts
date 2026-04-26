// Public surface for the components submodule.
//
// All components are pure RN (no NativeWind, no expo-haptics, no expo-router)
// so the SDK can be consumed from contexts that don't have those wired up:
// previews, Storybook, snapshot tests, future docs site.

export { ChoiceButton, type ChoiceButtonProps, type ChoiceState } from './ChoiceButton';
export { ReportButton, type ReportButtonProps } from './ReportButton';
export { QuestionCard, type QuestionCardProps } from './QuestionCard';
export { AccentLayer, type AccentLayerProps } from './AccentLayer';
