---
name: Forest Sanctuary
colors:
  surface: '#f9faf8'
  surface-dim: '#d9dad8'
  surface-bright: '#f9faf8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f2'
  surface-container: '#edeeec'
  surface-container-high: '#e7e8e6'
  surface-container-highest: '#e1e3e1'
  on-surface: '#191c1b'
  on-surface-variant: '#434843'
  inverse-surface: '#2e3130'
  inverse-on-surface: '#f0f1ef'
  outline: '#737973'
  outline-variant: '#c3c8c1'
  surface-tint: '#4d6453'
  primary: '#061b0e'
  on-primary: '#ffffff'
  primary-container: '#1b3022'
  on-primary-container: '#819986'
  inverse-primary: '#b4cdb8'
  secondary: '#43664d'
  on-secondary: '#ffffff'
  secondary-container: '#c2e9c9'
  on-secondary-container: '#476a51'
  tertiary: '#001c0b'
  on-tertiary: '#ffffff'
  tertiary-container: '#0b321c'
  on-tertiary-container: '#749c7e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d0e9d4'
  primary-fixed-dim: '#b4cdb8'
  on-primary-fixed: '#0b2013'
  on-primary-fixed-variant: '#364c3c'
  secondary-fixed: '#c4eccc'
  secondary-fixed-dim: '#a9d0b1'
  on-secondary-fixed: '#00210e'
  on-secondary-fixed-variant: '#2b4e36'
  tertiary-fixed: '#c2edcb'
  tertiary-fixed-dim: '#a7d1b0'
  on-tertiary-fixed: '#00210f'
  on-tertiary-fixed-variant: '#294e36'
  background: '#f9faf8'
  on-background: '#191c1b'
  surface-variant: '#e1e3e1'
typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  page-title:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.015em
  page-title-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  section-heading:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  card-title:
    fontFamily: Plus Jakarta Sans
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-secondary:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.01em
  caption:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  gutter-lg: 2rem
  margin: 2rem
  margin-sm: 1rem
  margin-lg: 4rem
  space-xs: 0.5rem
  space-sm: 1rem
  space-md: 1.5rem
  space-lg: 2rem
  space-xl: 3rem
  space-2xl: 4rem
---

## Brand & Style

This design system establishes an elevated, calm, and intellectually stimulating environment for live quizzing, knowledge sharing, and collaborative community engagement. In direct opposition to loud, hyper-gamified trivia apps and neon-saturated SaaS dashboards, the aesthetic embodies organic sophistication and mature restraint.

The style merges **Minimalism** with **Tactile Subtlety**:

- **Character**: Poised, cerebral, grounded, intentional, and quietly confident.
- **Emotional Resonance**: Clear-headed focus, academic dignity, and unhurried community warmth.
- **Visual Tenets**: Generous breathing space, deliberate organic earth tones, whisper-soft depth rather than harsh contrast, and razor-sharp typographic hierarchy.

## Colors

The palette is rooted in botanical permanence, trading digital harshness for the muted tranquility of deep temperate woodlands, soft lichen, and sun-warmed alabaster stone.

### Palette Architecture

- **Primary Canvas (`#F9FAF8`)**: A pale alabaster neutral serving as the base foundation, preventing stark glare while keeping the interface bright and breathable.
- **Surface & Cards (`#FFFFFF`)**: Pure, untinted white reserved for foreground surfaces, elevation cards, and elevated dialogs.
- **Primary Brand / Deep Forest Pine (`#1B3022`, deep tone `#142419`)**: The authoritative anchor used for high-emphasis buttons, deep titles, and definitive navigation marks.
- **Primary Accents / Muted Moss & Sage (`#3D6047`, lighter sage `#5B8266`)**: Subtle directional markers, focus indicators, active states, and quiet iconography.
- **Surface Tints / Moss Wash (`#EBF1EC`)**: Gentle tint for secondary button fills, selected list tiles, and hover surfaces.
- **Borders & Rules (`#E6E9E4` / `#E2E6E0`)**: Low-contrast architectural lines that gently delineate modules without creating visual cages.

### Text & Semantic Application

- **Primary Text (`#131B15`)**: A deep charcoal enriched with forest pigment for dense, fatigue-free readability.
- **Secondary Text (`#5C665F`)**: Warm slate-olive for supporting metadata, descriptions, and structural subtitles.
- **Live / Active Status**: Pigment `#245736` on background `#E6EFE9`.
- **Scheduled / Upcoming Status**: Ochre-olive `#5C5224` on background `#F4F1E6`.
- **Draft / Inactive Status**: Charcoal mist `#606662` on background `#EAECE9`.

## Typography

The type system utilizes Plus Jakarta Sans exclusively across all levels to balance precise humanist geometry with approachable rhythm. The typographic scale avoids decorative flourish, relying instead on deliberate weight contrasts, exact line-height ratios, and tightening negative letter-spacing on larger titles to produce a refined, editorial impression.

- **Display & Page Titles**: Bound with negative tracking (`-0.02em` to `-0.015em`) to retain visual density and polish at large scales.
- **Body Rhythm**: Tuned to a generous 1.6x line-height ratio (`15px` / `24px`) to ensure prolonged comprehension during complex live reading, quiz participation, and analytical reviews.
- **Labels & Metadata**: Set with slight positive tracking (`0.01em`) and medium-to-semi-bold weights for rapid scanning in live leaderboards, badges, and time indicators.

## Layout & Spacing

The layout is built upon an 8pt base grid with an intentional bias toward generous vertical white space. Content is housed within a 12-column responsive fluid grid pinned to an intentional maximum container width of `1280px`, preventing sprawling dashboard fatigue.

### Responsive Breakpoints & Margin Rules

- **Desktop (≥ 1024px)**: 12-column grid, `margin-lg` (`4rem` / `64px`) page boundary, and `gutter-lg` (`2rem` / `32px`). Content sections maintain a `space-2xl` (`64px`) vertical clearance.
- **Tablet (768px – 1023px)**: 8-column grid, `margin` (`2rem` / `32px`) page margin, and `gutter` (`1.5rem` / `24px`). Multi-column card sets reflow into dual-column grids.
- **Mobile (< 768px)**: 4-column grid, `margin-sm` (`1rem` / `16px`) side margins, and `gutter-sm` (`1rem` / `16px`). Grids collapse into vertical single stacks.

### Rhythm & Density

Spacing between internal card items adheres strictly to `space-xs` (8px) for title-caption stacks, `space-sm` (16px) for item metadata partitions, and `space-md` (24px) for card interior padding.

## Elevation & Depth

Visual hierarchy is communicated through an understated marriage of **tonal layering**, **diffused organic ambient shadows**, and **stone-tinted micro-borders**. Harsh dropshadows and heavy drop-down cutouts are prohibited.

### Tonal Surface Hierarchy

- **Base Canvas (`#F9FAF8`)**: The resting foundational plane.
- **Level 1 (Card & Module Surface, `#FFFFFF`)**: Resting cards sit upon the canvas bounded by a 1px border (`#E6E9E4`) and a warm, wide-angle ambient shadow:
  `0 1px 3px rgba(19, 27, 21, 0.03), 0 6px 16px rgba(19, 27, 21, 0.02)`.
- **Level 2 (Interactive Hover & Popovers)**: Cards lift smoothly upon user intention (`translateY(-2px)`), deepening the shadow with an olive-tinted diffusion:
  `0 4px 6px rgba(19, 27, 21, 0.04), 0 12px 24px rgba(19, 27, 21, 0.04)`.
- **Level 3 (Modals, Overlays, Floating Sheets)**:
  Floating interface layers receive a focused perimeter shadow:
  `0 8px 30px rgba(19, 27, 21, 0.08), 0 2px 8px rgba(19, 27, 21, 0.04)`. Modals are coupled with a backdrop scrim: `#131B15` at 30% opacity with a `4px` backdrop blur.

## Shapes

The design system employs a **Rounded (`2`)** geometry baseline. Shapes balance architectural stability with organic softness:

- **Base Radius (`0.5rem` / `8px`)**: Primary standard applied to buttons, input fields, interactive menu items, dropdown menus, and standard utility controls.
- **Large Radius (`rounded-lg`, `1rem` / `16px`)**: Applied consistently to quiz cards, project modules, panel groupings, and informational callouts.
- **Extra Large Radius (`rounded-xl`, `1.5rem` / `24px`)**: Reserved for primary platform modal sheets and hero feature surfaces.
- **Full Pill (`9999px`)**: Exclusively reserved for status badges, live indicator tags, and category chips.

## Components

### Buttons

- **Primary**: Solid Deep Forest Pine (`#1B3022`) background, crisp `#FFFFFF` text. Height is 44px (48px for hero triggers), corner radius 8px. Hover shifts background to `#142419` with a subtle 1px upward transform. Active state compresses down 1px.
- **Secondary**: Light moss wash background (`#EBF1EC`) with muted moss text (`#3D6047`). On hover, background shifts to `#DFE7E1`.
- **Outline / Neutral**: Pure `#FFFFFF` background with subtle stone border (`#E6E9E4`) and charcoal-forest text (`#131B15`). On hover, border color deepens to `#3D6047` and surface shifts to `#F9FAF8`.
- **Ghost**: Transparent fill, muted text (`#5C665F`). Hover triggers a delicate `#EBF1EC` fill with primary text color.

### Form Inputs

- Height is fixed at 48px with 16px horizontal internal padding.
- Base border is 1px solid `#E2E6E0` over pure white `#FFFFFF` surface.
- Typography is `body` (`15px`). Placeholder is warm slate-olive at 60% opacity.
- Focus state eliminates standard blue rings, introducing a 1px border recolor to Sage (`#3D6047`) coupled with an ambient focus glow: `0 0 0 3px rgba(61, 96, 71, 0.12)`.

### Cards (Quiz & Project Modules)

- Pure white container (`#FFFFFF`) with 24px (`space-md`) interior padding and `rounded-lg` (16px) corners.
- Encased in a single 1px subtle stone border (`#E6E9E4`). Gimmicky colored left borders or heavy card frames are explicitly avoided.
- Vertical layout stack:
  1. Top metadata line: Subtle status badge aligned left, quiz participant count or scheduling timestamp aligned right (caption typography in `#5C665F`).
  2. Headline block: Card title (`card-title`, `#131B15`) followed by 8px space to description (`body-secondary`, `#5C665F`).
  3. Base footer: Author/host lockup or action button aligned along the lower edge, demarcated by clean whitespace rather than horizontal rules.

### Status Chips & Badges

- Pill-shaped (`9999px` radius), compact padding: 4px vertical by 10px horizontal.
- Typography: `caption` (`12px`, weight 600, letter spacing `0.01em`).
- **Live Now**: Background `#E6EFE9`, text `#245736`. Incorporates a pulsing 6px circular dot (`#245736`).
- **Scheduled**: Background `#F4F1E6`, text `#5C5224`.
- **Draft / Completed**: Background `#EAECE9`, text `#606662`.

### Checkboxes & Radio Buttons

- 20px dimension with 6px border radius (checkbox) or full circular radius (radio).
- Unchecked: Pure white surface with 1.5px border `#E2E6E0`.
- Checked: Deep Forest Pine fill (`#1B3022`) displaying a centered pure white crisp checkmark or dot.

### Community & Live Quiz Lists

- Row items are structured with 16px vertical padding, separated by soft hair-lines (`1px solid #E6E9E4`).
- Interactive list tiles transition smoothly on hover to a rounded (8px) tinted moss wash (`#EBF1EC`) with zero layout shift.
- Numeric rank identifiers (e.g. leaderboard podiums) adopt `section-heading` scale with muted slate `#5C665F` rather than saturated gamified metals.
