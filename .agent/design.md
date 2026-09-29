---
description: Seguir o design default
---

---

name: Obsidian Mint Interface
colors:
surface: '#0f131c'
surface-dim: '#0f131c'
surface-bright: '#353942'
surface-container-lowest: '#0a0e16'
surface-container-low: '#181c24'
surface-container: '#1c2028'
surface-container-high: '#262a33'
surface-container-highest: '#31353e'
on-surface: '#dfe2ee'
on-surface-variant: '#bbcac0'
inverse-surface: '#dfe2ee'
inverse-on-surface: '#2c3039'
outline: '#85948b'
outline-variant: '#3c4a42'
surface-tint: '#45dfa4'
primary: '#5af0b3'
on-primary: '#003825'
primary-container: '#34d399'
on-primary-container: '#00563b'
inverse-primary: '#006c4b'
secondary: '#68dba9'
on-secondary: '#003825'
secondary-container: '#25a475'
on-secondary-container: '#00311f'
tertiary: '#a7ddff'
on-tertiary: '#00354a'
tertiary-container: '#50c6ff'
on-tertiary-container: '#00506e'
error: '#ffb4ab'
on-error: '#690005'
error-container: '#93000a'
on-error-container: '#ffdad6'
primary-fixed: '#68fcbf'
primary-fixed-dim: '#45dfa4'
on-primary-fixed: '#002114'
on-primary-fixed-variant: '#005137'
secondary-fixed: '#85f8c4'
secondary-fixed-dim: '#68dba9'
on-secondary-fixed: '#002114'
on-secondary-fixed-variant: '#005137'
tertiary-fixed: '#c4e7ff'
tertiary-fixed-dim: '#7bd0ff'
on-tertiary-fixed: '#001e2c'
on-tertiary-fixed-variant: '#004c69'
background: '#0f131c'
on-background: '#dfe2ee'
surface-variant: '#31353e'
typography:
display-lg:
fontFamily: Space Grotesk
fontSize: 32px
fontWeight: '700'
lineHeight: 40px
letterSpacing: -0.02em
headline-lg:
fontFamily: Space Grotesk
fontSize: 24px
fontWeight: '600'
lineHeight: 32px
letterSpacing: -0.015em
headline-md:
fontFamily: Space Grotesk
fontSize: 18px
fontWeight: '600'
lineHeight: 24px
letterSpacing: -0.01em
headline-sm:
fontFamily: Space Grotesk
fontSize: 15px
fontWeight: '600'
lineHeight: 20px
letterSpacing: -0.005em
body-lg:
fontFamily: Geist
fontSize: 15px
fontWeight: '400'
lineHeight: 22px
letterSpacing: 0em
body-md:
fontFamily: Geist
fontSize: 13px
fontWeight: '400'
lineHeight: 19px
letterSpacing: 0.005em
body-sm:
fontFamily: Geist
fontSize: 12px
fontWeight: '400'
lineHeight: 16px
letterSpacing: 0.01em
label-md:
fontFamily: Geist
fontSize: 12px
fontWeight: '500'
lineHeight: 16px
letterSpacing: 0.02em
label-sm:
fontFamily: Geist
fontSize: 10px
fontWeight: '600'
lineHeight: 14px
letterSpacing: 0.04em
rounded:
sm: 0.25rem
DEFAULT: 0.5rem
md: 0.75rem
lg: 1rem
xl: 1.5rem
full: 9999px
spacing:
gutter: 0.75rem
margin: 1rem
space-xs: 0.25rem
space-sm: 0.5rem
space-md: 0.75rem
space-lg: 1.25rem
space-xl: 2rem

---

## Brand & Style

The design system establishes a cyber-futuristic, high-fidelity desktop workspace for real-time collaboration. It pairs deep obsidian backdrops with translucent acrylic panels and an electric mint accent (`#34d399`). Built specifically for native desktop environments, it balances the weightlessness of frosted glass with technical precision, geometric sharpness, and high-density information architecture.

The visual style blends dark glassmorphism with high-contrast cybernetics. Interfaces evoke focused command-center energy: translucent smoked-slate panels, delicate light-catching borders (`rgba(255, 255, 255, 0.08)`), luminous emerald indicators, and crisp monospaced-influenced structural hierarchy. The atmosphere remains calm, immersive, and premium, prioritizing low visual fatigue during high-bandwidth communications.

## Colors

The color palette centers on intense, luminous emerald greens anchored against deep void tones:

- **Primary (`#34d399`)**: High-luminance mint. Utilized for call-to-action buttons, active messaging states, online telemetry nodes, and key interactive highlights.
- **Secondary (`#059669`)**: Deep forest emerald. Serves as supporting tone for subtle gradient transitions, focused state boundaries, and active container fills.
- **Tertiary (`#38bdf8`)**: Electric cyan. Reserved for hyperlinked mentions, specialized bot activity, and media streaming indicators.
- **Neutral Base (`#0b0f17`)**: Deep obsidian base canvas. Augmented through tiered translucent alpha values:
  - Surface Glass: `rgba(15, 23, 42, 0.65)` with `backdrop-filter: blur(24px)`
  - Panel Elevation: `rgba(30, 41, 59, 0.45)` with subtle inner glow
  - Inner Stroke Line: `rgba(255, 255, 255, 0.08)`
  - Text Primary: `#f8fafc`
  - Text Secondary: `#94a3b8`
  - Text Muted: `#475569`

## Typography

The type system pairs the architectural geometry of `Space Grotesk` with the ultra-clean functional readability of `Geist`.

- **Headlines (`Space Grotesk`)**: Provides sharp character traits to usernames, room titles, window labels, and modal headings. Letter-spacing is slightly contracted to ensure tight, modern optical balance.
- **Body & Labels (`Geist`)**: Handles real-time conversation streams, metadata timestamps, input values, and micro-labels. Its technical geometry retains exceptional legibility across dense translucent cards and variable background opacities.

## Layout & Spacing

The layout is built for native desktop canvas density with dual-pane and triple-pane structural compositions:

- **Desktop Shell**: An outer inset frame of `1rem` margin housing the primary multi-column layout. The native window title bar uses a fixed height of `48px` including window traffic controls (`close`, `minimize`, `maximize`) spaced at `8px` gap.
- **Sidebar & Feed Panes**: Left navigation/contact pane is fixed-to-fluid (`280px` to `340px`), separated from the main chat viewport by a `0.75rem` gutter.
- **Message Streams**: Chat streams follow a compact `0.5rem` message gap with grouped messages collapsing to `0.25rem`. Structural card paddings hold rigidly to `0.75rem` and `1.25rem` intervals.

## Elevation & Depth

Visual hierarchy does not rely on opaque cast shadows, but on stacked translucent light volumes:

- **Canvas Level (Base)**: `#0b0f17` with subtle ambient radial gradients blooming in `#059669` at 8% opacity.
- **Secondary Glass Panel (Sidebar)**: Background `rgba(15, 23, 42, 0.65)`, backdrop-blur `20px`, border `1px solid rgba(255, 255, 255, 0.06)`.
- **Primary Glass Panel (Active Viewport)**: Background `rgba(17, 24, 39, 0.75)`, backdrop-blur `28px`, border `1px solid rgba(255, 255, 255, 0.10)`, inner box-shadow `inset 0 1px 0 rgba(255, 255, 255, 0.08)`.
- **Floating Controls & Modals**: Background `rgba(30, 41, 59, 0.85)`, backdrop-blur `32px`, box-shadow `0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(255, 255, 255, 0.12)`.
- **Neon Luminance**: Real-time status points and active selection cards emit subtle localized box-shadow blooms (`0 0 12px rgba(52, 211, 153, 0.3)`).

## Shapes

The design system standardizes on medium structural corner radii (`roundedness: 2`):

- **Window & Viewport Frames**: `1rem` (`rounded-lg`) corner curvature creates a unified OS container aesthetic.
- **Panels & Cards**: `0.75rem` to `1rem` corner rounding preserves the smooth glass container look.
- **Interactive Controls (Inputs, Message Bubbles)**: Standard `0.5rem` (`rounded-md`) rounding to maintain an intentional cybernetic structure.
- **Pill Badges & Presence Indicators**: Full rounding (`9999px`) reserved specifically for numeric counter badges, status tags, and avatar presence markers.

## Components

### Buttons & Quick Actions

- **Primary Action (Send/Call)**: Solid `#34d399` background with `#0b0f17` text and bold iconography. Hover transitions to bright mint with a soft glow `box-shadow: 0 0 16px rgba(52, 211, 153, 0.4)`. Border radius is `0.5rem`.
- **Ghost/Icon Button**: Transparent surface, border `1px solid transparent`, icon color `#94a3b8`. Hover adds `background: rgba(255, 255, 255, 0.06)` and border `rgba(255, 255, 255, 0.08)`.

### Message Bubbles

- **Received Messages**: Background `rgba(30, 41, 59, 0.55)` with `1px solid rgba(255, 255, 255, 0.05)`, text `#f8fafc`, rounded corners (`0.5rem`) with top-left anchor.
- **Sent Messages**: Background `rgba(5, 150, 105, 0.25)` with `1px solid rgba(52, 211, 153, 0.35)`, text `#f8fafc`, soft mint highlights on embedded links.

### Input Fields

- **Message Composer**: Embedded glass container with `rgba(15, 23, 42, 0.8)` background, border `1px solid rgba(255, 255, 255, 0.08)`, inner vertical padding `0.625rem`, horizontal padding `0.875rem`. Focus ring triggers `border-color: rgba(52, 211, 153, 0.6)` and `box-shadow: 0 0 10px rgba(52, 211, 153, 0.15)`.

### Badges & Status Indicators

- **Unread Count Badges**: Pill-shaped (`9999px`), background `#34d399`, text `#0b0f17`, font size `10px`, font weight `700`, padding `2px 7px`.
- **Active Presence Marker**: `8px` circular badge positioned on avatar base, fill `#34d399`, ring `2px solid #0b0f17`, pulsing animation on active connection.

### Contact & Channel Item

- **Default Item**: Padding `0.625rem 0.75rem`, rounded corner `0.5rem`, transition all `150ms`.
- **Selected State**: Background `rgba(30, 41, 59, 0.65)`, border `1px solid rgba(52, 211, 153, 0.25)`, subtle left indicator stroke in `#34d399`.
