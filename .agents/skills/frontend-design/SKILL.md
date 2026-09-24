---
name: frontend-design
description: Use for QuizMB frontend UI implementation, modification, and review.
---

# QuizMB Frontend Rules

## Core Principle
The implemented design system inside `apps/web` is authoritative for normal frontend work.

Do not reread `/references/design/DESIGN.md` for routine feature implementation.

Read `/references/design/DESIGN.md` only when:
- creating the design system for the first time,
- changing or extending design tokens,
- adding a new design-system primitive,
- resolving a visual rule not represented in code.

If a needed design decision is not represented by existing tokens/components, ask before inventing it.

## Before Creating UI
1. Inspect existing design tokens.
2. Inspect reusable components.
3. Inspect related screens and patterns.
4. Reuse existing typography, buttons, inputs, cards, badges, and layout primitives.
5. Avoid creating a second implementation of an existing concept.
6. Prefer composition over prop-heavy components.
7. Prefer Server Components unless client behavior is required.
8. Preserve accessibility and responsive behavior.

## Design Tokens
Always reuse existing tokens for colors, typography, spacing, radii, shadows, focus states, and surfaces.

Do not introduce random hex colors, font sizes, line heights, spacing values, radii, shadows, or focus rings.

Avoid feature-level values such as `bg-[#1B3022]`, `text-[15px]`, or `rounded-[16px]`.

Prefer semantic tokens and reusable component APIs.

Do not modify or extend the token system without explicit approval.

## Reuse Before Creation
Before creating a component:
1. Search for an existing component serving the same purpose.
2. Reuse or extend it when the concept is the same.
3. Do not create feature-local replacements for shared primitives.
4. Do not create separate components that differ only by minor styling.

Prefer `<Button variant="secondary">Create quiz</Button>` over feature-specific button components.

## Component Design
Use compound components when several related parts share state or benefit from flexible composition.

Use them when:
- related elements share implicit state,
- a component has flexible slots,
- child order/presence varies,
- consumers benefit from composition.

Do not use them when structure is fixed, the component is simple, or only a few straightforward props are needed.

Do not use compound components merely because they look architecturally elegant.

## Props API Design
Use consistent names across components.

Good:
```tsx
<Input disabled />
<Button disabled />
<Select disabled />
```

Use positive boolean names such as `disabled`, `open`, and `required`.

Avoid double negatives such as `notEnabled` or `isNotClosed`.

Component callback props use the `on...` convention.

Good:
```tsx
<Input onChange={} onBlur={} />
<Dialog onOpenChange={} />
```

Avoid public prop names such as `handleChange` or `blurHandler`.

## Variants
Use explicit variants for stable visual or behavioral differences.

Good:
```tsx
<Button variant="primary" size="md" />
```

Avoid boolean soup:
```tsx
<Button primary large rounded />
```

Do not add a variant just to fix one screen.

Before adding one, ask:
- Is it a real design-system distinction?
- Will it be reused?
- Could composition solve it instead?

## Avoid Prop Explosion
Prefer composition when children naturally represent structure.

Good:
```tsx
<Button>
  <Icon />
  Create quiz
</Button>
```

Avoid excessive props controlling every visual detail.

## Avoid Premature Abstraction
Do not create abstractions for speculative reuse.

Create a reusable component when:
- it is an established design-system primitive,
- the same pattern is already repeated,
- or approved upcoming screens clearly require the same concept.

Keep one-off feature markup local until a stable pattern emerges.

## Cross-Screen Consistency
The same product concept must share the same foundational design across screens.

Examples:
- quiz cards across dashboard, projects, history, and participant views
- question presentation across creation, host preview, participant view, and result view
- status badges across all surfaces
- form fields across auth and quiz creation

Do not redesign the same concept independently for each feature.

Differences should come from context or state, not accidental redesign.

## Next.js Boundaries
Prefer Server Components by default.

Use Client Components only when required for browser APIs, event handlers, local interactive state, realtime behavior, or client-side form interaction.

Keep `"use client"` as low in the tree as practical.

Do not turn an entire page or layout into a Client Component because one child is interactive.

## State Ownership
Persistent business state comes from the backend.

Realtime shared state comes from Socket.IO.

Local React state should mainly manage temporary form input, unsubmitted selections, dialogs, tabs, and presentation state.

Do not make the browser authoritative for quiz state, timing, score, rank, or accepted answers.

## Semantic HTML and Accessibility
Reusable components must preserve semantic HTML.

Examples:
- button actions render `<button>`
- navigation uses links
- inputs have associated labels
- headings preserve logical hierarchy
- dialogs have accessible names and focus behavior

Interactive elements must support keyboard use, visible focus states, disabled states where relevant, adequate touch targets, and sufficient contrast.

Do not sacrifice semantics for visual abstraction.

## Responsive Behavior
Design intentionally for desktop, tablet, and mobile.

Preserve hierarchy, readable typography, whitespace, comfortable touch targets, and clear navigation.

Do not simply shrink desktop layouts.

## Tailwind Usage
Use Tailwind and the existing design-token implementation.

Prefer semantic tokens, established utilities, and reusable variants.

Avoid arbitrary values everywhere, copied large class strings, page-specific color systems, inline styles without a real need, and multiple styling systems.

Do not introduce another styling framework without approval.

## Page Responsibilities
Page components should mainly compose layouts, feature sections, reusable primitives, and data boundaries.

Avoid placing reusable styling logic, domain logic, transport logic, or duplicated visual patterns directly inside page files.

## Frontend Review Checklist
Before finishing frontend work, verify:
- existing components were reused where appropriate
- no duplicate design-system primitives were introduced
- no random colors/font sizes/spacing/radii were added
- no unnecessary `"use client"` boundary was introduced
- component APIs use consistent naming
- no boolean-prop explosion was introduced
- composition was preferred where flexibility is required
- semantic HTML is preserved
- keyboard and focus behavior work
- mobile layout is intentional
- related QuizMB product objects remain visually consistent
- no unapproved UI or state-management library was introduced
