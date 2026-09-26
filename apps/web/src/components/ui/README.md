# QuizMB UI

Import primitives from `@/components/ui`. Tokens live in `src/styles/tokens.css`; `globals.css` loads them into Tailwind. Plus Jakarta Sans is loaded as a variable font through `next/font/google` in the root layout, with swap and self-hosted build output.

## Public components

- `Button`: native button props; `variant="primary" | "secondary" | "outline" | "ghost" | "danger"`; default primary. `size="default"` is 44px; primary also supports `size="hero"` at 48px. Use danger for destructive actions such as signing out. Default native type is `button`; explicitly choose `submit` in real forms. Supports native disabled and ref. No loading, icon-only, or link-button variants.
- `Text`: `variant="display" | "page-title" | "section-heading" | "card-title" | "body" | "body-secondary" | "label" | "caption"`; default body. `as` is p (default), span, or h1–h6. `tone="primary" | "secondary"`. Select heading tags by document structure, independently of appearance. Display/page title switch from mobile to desktop scale at the tablet breakpoint.
- `Input`: native text-like input props and ref; supports text, email, password, search, tel, url, number. Fixed 48px height. Give it a visible label or an accessible name. Native disabled/required/readOnly and aria-invalid are supported. Checkbox/radio/file/date controls are intentionally excluded.
- `FormField`: Input props plus required `label`, optional `hint`, and optional error string. Generates an ID when omitted, connects label/hint/error, merges existing aria-describedby, and sets aria-invalid on error. `className` styles the input. This is the only client primitive, using React useId; no form state or validation library is included.
- `Surface`: `as="div" | "section" | "article"`, native HTML attributes, className. One resting card treatment: white surface, stone border, 24px padding, 16px radius, ambient shadow. It does not imply clickability. No product metadata/footer structure is baked in.
- `Badge`: required `variant="live" | "scheduled" | "draft" | "completed"`, native span attributes/ref, matching default text. Optional `label` supplies contextual wording such as "Live Ready" or a scheduled time without adding a visual variant. Live, scheduled, draft, and completed use distinct semantic palettes; live includes a decorative pulse dot, and reduced-motion disables animation. No extra status variants or implicit live-region announcements.

All primitives accept className for composition. Use semantic utilities for customization; do not introduce raw palette values or replace the focus treatment. Components remain server-compatible except FormField. Interactive Button handlers must be passed from a client component.

## Semantic token usage

- Surfaces: `bg-canvas`, `bg-surface`, `bg-surface-low`, `bg-surface-muted`, `bg-surface-high`, `bg-surface-highest`, `bg-surface-dim`, `bg-surface-inverse`.
- Text: `text-text-primary`, `text-text-secondary`, `text-text-inverse`. Use inverse text on inverse surfaces.
- Actions: `bg-action-primary` with `text-action-on-primary`; `bg-action-secondary` with `text-accent`. Hover tokens are centralized too.
- Boundaries: `border-border-surface`, `border-border-control`, `border-(length:--stroke-width)`.
- Spacing: `space-xs/sm/md/lg/xl/2xl` tokens become utilities such as `gap-space-xs`, `p-space-md`, and `space-y-space-2xl`. Title/description stacks use xs; internal partitions sm; card padding md.
- Layout: max-w-content (1280px); mobile px-margin-sm/gap-gutter-sm, tablet md:px-margin/md:gap-gutter, desktop lg:px-margin-lg/lg:gap-gutter-lg. Tablet begins at 768px; desktop at 1024px. Structural grids use 4/8/12 columns; card collections can use one/two columns as documented.
- Shapes: rounded-control (8px), rounded-card (16px), rounded-feature (24px), rounded-pill (badges/tags only). Small and medium radius tokens are retained for future approved uses.
- Elevation: shadow-card, shadow-raised, shadow-floating. Floating layers use bg-scrim and the overlay-blur token; no modal/popover components are included.
- Focus: ds-focus adds a visible accent outline and the ambient glow. Inputs use the documented accent border plus shadow-focus. Browser forced-color modes should retain their system control treatment.

Use Text for typography or its equivalent semantic Tailwind text utilities. Body is 15/24, secondary body 14/20, label 13/18, caption 12/16. Badge typography deliberately differs from caption (600 weight and positive tracking).

## Design-system ownership

The implemented QuizMB tokens and primitives are the visual source of truth. Approved color values live directly in semantic theme tokens in `src/styles/tokens.css`. Feature code consumes semantic utilities and primitives, never raw palette values. `docs/DESIGN.md` is historical/reference documentation.

The foundation uses accent focus styling with a visible keyboard outline, centralized disabled opacity and motion timing, and danger tokens for invalid fields. These are accessibility/behavior defaults, not additional variants.

Static Surface does not lift on hover. The documented elevated shadow and hover translation token are available for future genuinely interactive surfaces, whose link/button semantics must be designed with their usage. Modal, checkbox/radio, and community/list implementations are intentionally outside this component set.

## Development showcase

Visit `/dev/design-system` with `pnpm --filter @quizmb/web dev`. The route calls notFound outside development, including production builds. It contains only primitive examples and does not submit forms or invoke product APIs.
