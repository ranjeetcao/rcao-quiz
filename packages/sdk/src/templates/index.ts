// Public surface for the templates submodule.
//
// QuestionCard (./components/QuestionCard.tsx) is the runtime consumer;
// the registry + pick helper are also imported directly by tests and by
// future tooling (e.g. a Storybook preview screen).

export { TEMPLATE_REGISTRY, type AccentKind, type Template } from './registry';
export { pickTemplate, templatesForSubject } from './pick';
