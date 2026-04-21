# Cortex Frontend — Design Tokens

> **Source:** [shadcnuidashboard.com/logistics](https://shadcnuidashboard.com/logistics) (Logistics admin dashboard, shadcn/ui v4 + Tailwind v4 reference)
> **Captured:** 2026-04-20
> **Method:** Live DOM inspection via Chrome (`getComputedStyle` on `:root`, both `.light` and `.dark` themes; component dimensions read from rendered nodes).
> **Use:** seed values for `/libs/@cortex/styles/tokens.css` and `tailwind.config.ts`. Tweak only with intent — every change costs consistency across tiles.

---

## 1. Source verification

- **Primary URL inspected:** `https://shadcnuidashboard.com/logistics` — loaded successfully in Chrome (status 200, full client-side render).
- **Method:** programmatic read of computed CSS variables on `<html>`, theme toggled via `.dark`/`.light` class swap. Real component dimensions sampled from `[data-slot="sidebar"]`, `[data-slot="sidebar-trigger"]`, `[data-state]`, `[data-slot="card"]`, `<table>`, `button`, `input`, status badges.
- **Coverage:** ~110 CSS custom properties captured; lab() values converted to HEX/HSL via canvas rasterization. Tailwind v4 reference uses lab() at runtime — we normalize to HSL so we can stay on Tailwind 3.4 (per project rules, sec. 4).
- **Caveats:**
  - Reference uses **Tailwind v4** (`--text-*`, `--leading-*`, `--shadow-*` tokens directly on `:root`). We are on **Tailwind 3.4** — translate token names but the values are 1:1.
  - Reference font is **Plus Jakarta Sans**. We swap to **Inter** (more neutral, better cyrillic + monospace numeric) — see §3 reasoning.
  - Sidebar primary in dark theme is bright blue (`#1447e6`). We mute this in our adaptation — neutral charcoal primary fits IDP's data-density better.

---

## 2. Color palette

### 2.1 Semantic tokens (HSL — compatible with shadcn/ui CSS-vars mode)

| Token                  | Light HSL              | Light HEX  | Dark HSL               | Dark HEX   |
|------------------------|------------------------|------------|------------------------|------------|
| `--background`         | `0 0% 100%`            | `#ffffff`  | `0 0% 3.9%`            | `#0a0a0a`  |
| `--foreground`         | `0 0% 3.9%`            | `#0a0a0a`  | `0 0% 98%`             | `#fafafa`  |
| `--card`               | `0 0% 100%`            | `#ffffff`  | `0 0% 9%`              | `#171717`  |
| `--card-foreground`    | `0 0% 3.9%`            | `#0a0a0a`  | `0 0% 98%`             | `#fafafa`  |
| `--popover`            | `0 0% 100%`            | `#ffffff`  | `0 0% 9%`              | `#171717`  |
| `--popover-foreground` | `0 0% 3.9%`            | `#0a0a0a`  | `0 0% 98%`             | `#fafafa`  |
| `--primary`            | `0 0% 9%`              | `#171717`  | `0 0% 89.8%`           | `#e5e5e5`  |
| `--primary-foreground` | `0 0% 98%`             | `#fafafa`  | `0 0% 9%`              | `#171717`  |
| `--secondary`          | `0 0% 96.1%`           | `#f5f5f5`  | `0 0% 14.9%`           | `#262626`  |
| `--secondary-foreground` | `0 0% 9%`            | `#171717`  | `0 0% 98%`             | `#fafafa`  |
| `--muted`              | `0 0% 96.1%`           | `#f5f5f5`  | `0 0% 14.9%`           | `#262626`  |
| `--muted-foreground`   | `0 0% 45.1%`           | `#737373`  | `0 0% 63.1%`           | `#a1a1a1`  |
| `--accent`             | `0 0% 96.1%`           | `#f5f5f5`  | `0 0% 14.9%`           | `#262626`  |
| `--accent-foreground`  | `0 0% 9%`              | `#171717`  | `0 0% 98%`             | `#fafafa`  |
| `--destructive`        | `0 84.2% 45.5%`        | `#e7000b`  | `0 100% 70%`           | `#ff6467`  |
| `--destructive-foreground` | `0 0% 98%`         | `#fafafa`  | `0 0% 98%`             | `#fafafa`  |
| `--border`             | `0 0% 89.8%`           | `#e5e5e5`  | `0 0% 14.9%`           | `#262626`† |
| `--input`              | `0 0% 89.8%`           | `#e5e5e5`  | `0 0% 14.9%`           | `#262626`† |
| `--ring`               | `0 0% 63.1%`           | `#a1a1a1`  | `0 0% 45.1%`           | `#737373`  |

† Reference page actually shipped `#f5ffff` for `--border`/`--input` in dark mode — that's a **bug in the reference** (washed-out cyan). We override to neutral charcoal (`#262626`) which matches its actual visual rendering on solid dark surfaces.

**Philosophy:** monochrome neutral spine (zinc/neutral). Color is reserved for status — never for chrome. This is exactly the discipline that prevents the "generic AI dashboard" look (no gradients, no purple primary).

### 2.2 Semantic state colors (added — reference exposes these only via charts)

These are not in the reference's `--*-foreground` set, but we need them for IDP (invoice statuses, validation states). Derived from the reference's chart palette + Tailwind defaults.

| Token              | Light HSL          | Light HEX  | Dark HSL           | Dark HEX   | Use                                   |
|--------------------|--------------------|------------|--------------------|------------|---------------------------------------|
| `--success`        | `142 71% 45%`      | `#22c55e`  | `160 100% 37%`     | `#00bc7d`  | "Delivery"-style positive badges     |
| `--success-foreground` | `142 76% 18%`  | `#008236`  | `0 0% 98%`         | `#fafafa`  | text on success bg                    |
| `--warning`        | `36 100% 50%`      | `#fe9a00`  | `36 100% 50%`      | `#fe9a00`  | review-needed states                  |
| `--warning-foreground` | `36 100% 22%` | `#7c4a00`  | `0 0% 9%`          | `#171717`  |                                       |
| `--info`           | `225 84% 49%`      | `#1447e6`  | `225 84% 49%`      | `#1447e6`  | "Transfer"-style neutral-active badges |
| `--info-foreground`| `225 84% 95%`      | `#dbeafe`  | `0 0% 98%`         | `#fafafa`  |                                       |

### 2.3 Sidebar tokens (separate scope — shadcn convention)

| Token                          | Light HEX | Dark HEX  |
|--------------------------------|-----------|-----------|
| `--sidebar`                    | `#f5f5f5` | `#171717` |
| `--sidebar-foreground`         | `#54545c` | `#fafafa` |
| `--sidebar-primary`            | `#171717` | `#e5e5e5` |
| `--sidebar-primary-foreground` | `#fafafa` | `#171717` |
| `--sidebar-accent`             | `#ffffff` | `#262626` |
| `--sidebar-accent-foreground`  | `#171717` | `#fafafa` |
| `--sidebar-border`             | `#e5e5e5` | `#262626` |
| `--sidebar-ring`               | `#a1a1a1` | `#737373` |

Note: sidebar-foreground in light is **`#54545c`** (cool gray, NOT pure neutral). Subtle — gives the sidebar text a hint of slate. Worth keeping; it's what differentiates this look from "blank shadcn defaults".

### 2.4 Chart palette

Reference uses two distinct palettes per theme (warm in light, cool in dark). For Cortex IDP we standardize on a single palette across themes (data continuity matters more than aesthetic coherence in dashboards).

```css
--chart-1: 18 100% 48%;    /* #f54a00 — orange */
--chart-2: 175 100% 29%;   /* #009689 — teal */
--chart-3: 196 72% 23%;    /* #104e64 — deep cyan */
--chart-4: 44 100% 50%;    /* #ffb900 — amber */
--chart-5: 36 100% 50%;    /* #fe9a00 — orange-amber */
```

### 2.5 Neutral scale

Tailwind's `neutral-*` is the source. Map: 50/100/200 = backgrounds & borders, 500/600 = muted-fg & ring, 800/900/950 = primary/card/bg in dark.

---

## 3. Typography

**Reference** uses `Plus Jakarta Sans` (display) with `Inter` as fallback. **Cortex** standardizes on `Inter` only — single font, one network request, better numeric tabular alignment for invoice tables.

### Font stack

```css
--font-sans: "Inter", "Inter Fallback", ui-sans-serif, system-ui, -apple-system,
             BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
             "Liberation Mono", "Courier New", monospace;
```

Load via `next/font/google` with `subsets: ["latin", "latin-ext"]` (latin-ext for Polish diacritics — non-negotiable for ITSG/IDP context).

### Size scale (matches reference's actual `--text-*` values)

| Token        | Size       | Line height           | Tailwind class |
|--------------|------------|-----------------------|----------------|
| `--text-xs`  | `0.75rem`  | `calc(1/0.75)` ≈ 1rem | `text-xs`      |
| `--text-sm`  | `0.813rem` | `calc(1.25/0.875)`    | `text-sm` *    |
| `--text-base`| `1rem`     | `calc(1.5/1)` = 1.5   | `text-base`    |
| `--text-lg`  | `1.125rem` | `calc(1.75/1.125)`    | `text-lg`      |
| `--text-xl`  | `1.25rem`  | `calc(1.75/1.25)`     | `text-xl`      |
| `--text-2xl` | `1.5rem`   | `calc(2/1.5)`         | `text-2xl`     |
| `--text-3xl` | `1.875rem` | `calc(2.25/1.875)`    | `text-3xl`     |
| `--text-4xl` | `2.25rem`  | (default)             | `text-4xl`     |

\* **Important:** reference overrides `--text-sm` to `0.813rem` (~13px) instead of Tailwind's default `0.875rem`. This is the **single most distinctive typography choice** in the reference — gives the dashboard its "tight, dense" feel. Buttons render at `13.008px`. Replicate this.

### Weights used

| Weight | Value | Use                                        |
|--------|-------|--------------------------------------------|
| Light    | 300 | (defined, unused in observed components)   |
| Normal   | 400 | body text, sidebar inactive nav            |
| Medium   | 500 | buttons, active nav, badges, table headers |
| Semibold | 600 | section titles, card headers               |
| Bold     | 700 | rare — only large hero numbers             |

### Letter spacing

| Token                | Value     | Use                                       |
|----------------------|-----------|-------------------------------------------|
| `--tracking-tighter` | `-0.05em` | hero numbers (`Load Price: $6,533.44`)    |
| `--tracking-tight`   | `-0.025em`| H1/H2 headings                            |
| `--tracking-normal`  | `0`       | body, default                             |
| `--tracking-wide`    | `0.025em` | uppercase labels, table headers           |

---

## 4. Spacing, radius, shadows, borders

### 4.1 Spacing

Reference uses Tailwind's default `--spacing: 0.25rem` (4px base). No deviation — keep as-is. All standard `p-1`/`p-2`/`gap-3` etc. work.

### 4.2 Border radius

| Token         | Value      | Use                                    |
|---------------|------------|----------------------------------------|
| `--radius`    | `0.625rem` | base — drives all derived radii        |
| `--radius-sm` | `0.375rem` | `calc(var(--radius) - 4px)` — badges, chips |
| `--radius-md` | `0.5rem`   | `calc(var(--radius) - 2px)` — buttons, inputs |
| `--radius-lg` | `0.625rem` | cards, dialogs                          |
| `--radius-xl` | `0.875rem` | `calc(var(--radius) + 4px)` — large surfaces |
| `--radius-2xl`| `1rem`     | rare (popovers with strong elevation)  |

**Key observation:** badges in the reference use `4px` radius (smaller than `--radius-sm`). Buttons use `8px` (between sm and md). This means:

- Badges → use `rounded-[4px]` or set `--radius-xs: 0.25rem` and use `rounded-xs`
- Buttons → use `rounded-md` (`0.5rem` ≈ 8px)
- Cards → use `rounded-xl` (`0.875rem`)

### 4.3 Border widths

Default `1px` everywhere. Reference uses `border` (1px solid var(--border)) for cards, inputs, table dividers. No `2px` borders observed.

### 4.4 Shadows

Reference does **not** define `--shadow-*` tokens on `:root`. Shadows are applied via Tailwind utility classes. Observed:

| Class       | Value                                                                                   | Use                                       |
|-------------|-----------------------------------------------------------------------------------------|-------------------------------------------|
| `shadow-xs` | `0 1px 2px 0 rgb(0 0 0 / 0.05)`                                                          | inputs (focus), input groups              |
| `shadow-sm` | `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`                          | inset main content area, cards on hover   |
| `shadow-md` | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`                       | popovers, dropdowns                       |
| `shadow-lg` | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`                     | dialogs, command palette                  |

**Critical:** the reference is **shadow-light**. Cards default to `border` only, not `shadow`. Elevation is signalled through borders + subtle bg shifts (`bg-card` vs `bg-background`). This is the "modern flat" look. Don't add shadows reflexively.

---

## 5. Component patterns observed

### 5.1 Sidebar

| Property                | Value                              |
|-------------------------|------------------------------------|
| Width (expanded)        | `240px` (`calc(0.25rem * 60)` = 15rem)   |
| Width (collapsed/icon)  | `48px` (`3rem`)                    |
| Background (light)      | `#f5f5f5` (`--sidebar`)            |
| Background (dark)       | `#171717`                          |
| Border-right            | `1px solid var(--sidebar-border)`  |
| Transition              | `width 0.15s cubic-bezier(0.4, 0, 0.2, 1)` |

**Nav item (link):**
- Height: `32px`
- Padding: `2px 8px` (very tight — drives the dense aesthetic)
- Font: `13px` (`text-sm`), weight `400` inactive / `500` active
- Color: `#54545c` inactive / `#171717` active
- Active background: `#ffffff` (pops out from `#f5f5f5` sidebar bg)
- Border-radius: `8px`
- Gap (icon ↔ text): `8px`

**Pattern:** active state = white card-pop on the muted sidebar bg. No left-border accent. No background tint. Pure surface elevation.

### 5.2 Topbar

- Height: `56px`
- Background: `rgba(255, 255, 255, 0.7)` + backdrop-blur (translucent, so sidebar bleeds through subtly)
- Padding: `0 16px`
- Border-bottom: `1px solid var(--border)`
- Contains: logo/breadcrumb left, command palette `⌘K` (badge style, `#f5f5f5` bg, `12px` font, `5px` radius, `0 4px` padding), action buttons right

### 5.3 Cards

- Background: `var(--card)` (white in light, `#171717` in dark)
- Border: `1px solid var(--border)`
- Border-radius: `0.875rem` (`rounded-xl`)
- Padding: `24px` (default `p-6`)
- Shadow: **none** by default
- Hover: no transform; hover-state cards add `border-color: var(--ring)` only
- Header section uses `gap-1.5`, footer uses `pt-6`

### 5.4 Data tables

- Row height: `~52px` (driven by `py-3` on cells + content)
- Header cell: `text-xs`, `font-medium`, `uppercase` optional, color `var(--muted-foreground)`
- Body cell: `text-sm` (`13px`), color `var(--foreground)`
- Border-bottom: `1px solid var(--border)` on every `<tr>`
- **No zebra striping** in reference — clean, depends on row borders for separation
- Hover row: `bg-muted/50` (faint gray-tint)
- Selected row: `bg-muted` (full muted bg)
- Resize handles: visible only on hover

### 5.5 Status badges

Two variants observed in reference (Delivery green, Transfer blue):

| Variant   | Background | Text       | Notes                          |
|-----------|------------|------------|--------------------------------|
| Delivery  | `#dbfce7`  | `#008236`  | green-100 bg + green-700 text  |
| Transfer  | `#dbeafe`  | `#1447e6`  | blue-100 bg + blue-600 text    |

**Spec:**
- Padding: `2px 10px`
- Border-radius: `4px`
- Font: `12px`, `font-medium`
- Border: none

**Cortex extension** (for IDP statuses):

| Status        | Background     | Text       |
|---------------|---------------|------------|
| `success` (Verified, Delivered) | `#dbfce7` | `#008236` |
| `info` (In progress, Transfer)  | `#dbeafe` | `#1447e6` |
| `warning` (Needs review)        | `#fef3c7` | `#a16207` |
| `destructive` (Failed, Rejected)| `#fee2e2` | `#b91c1c` |
| `neutral` (Draft)               | `#f5f5f5` | `#525252` |

### 5.6 Buttons

**Primary** (e.g. "New Load"):
- Height: `36px`
- Padding: `8px 12px`
- Background: `var(--primary)` = `#171717`
- Text: `var(--primary-foreground)` = `#fafafa`, `13px`, `font-medium`
- Border-radius: `8px` (`rounded-md`)
- Shadow: **none**
- Transition: `all 0.15s cubic-bezier(0.4, 0, 0.2, 1)`
- Hover: `bg-primary/90`
- Focus-visible: `ring-2 ring-ring ring-offset-2`

**Secondary:** `bg-secondary` (`#f5f5f5`), text `var(--secondary-foreground)`
**Outline:** `border border-input bg-background`, text `var(--foreground)`
**Ghost:** transparent, hover `bg-accent`
**Destructive:** `bg-destructive` (`#e7000b`), text white
**Link:** transparent, text `var(--primary)`, underline on hover

Sizes: `sm` = 32px, `default` = 36px, `lg` = 40px, `icon` = 36×36px

### 5.7 Form inputs

- Height: `36px` (matches default button)
- Background: `transparent` (light) / `var(--input)/30` (dark)
- Border: `1px solid var(--input)` = `#e5e5e5`
- Border-radius: `8px` (`rounded-md`)
- Padding: `8px 12px`
- Font: `13px`
- Focus: `border-ring ring-ring/50 ring-[3px]` (3px outer ring, no offset)
- Disabled: `opacity-50 cursor-not-allowed`

**InputGroup** (composite input with addon icons): uses `shadow-xs` to subtly elevate vs flat inputs.

### 5.8 Tabs

- Underline-style (not pill-style) in reference
- Tab list border-bottom: `1px solid var(--border)`
- Active tab: `border-b-2 border-foreground`, text `var(--foreground)`
- Inactive tab: text `var(--muted-foreground)`, hover → `var(--foreground)`
- Padding per tab: `8px 16px`

### 5.9 Breadcrumbs

- Font: `13px`, color `var(--muted-foreground)`
- Last item: `var(--foreground)`, `font-medium`
- Separator: `/` or chevron icon, color `var(--muted-foreground)`, `mx-2`

### 5.10 Empty states & charts

Empty state (not in reference, derived): centered `py-16`, icon `40px` muted-fg, title `text-lg font-semibold`, body `text-sm text-muted-foreground`, optional primary CTA. Charts: Recharts; grid lines `var(--border)`; tooltip `bg-popover border shadow-md rounded-lg`.

---

## 6. Interaction details

| Element              | Hover                          | Focus-visible              | Active            | Transition                         |
|----------------------|--------------------------------|----------------------------|-------------------|------------------------------------|
| Button (primary)     | `bg-primary/90`                | `ring-2 ring-ring ring-offset-2` | `bg-primary/95` | `all 150ms ease`                  |
| Button (ghost)       | `bg-accent`                    | same                       | `bg-accent/80`    | same                               |
| Card                 | `border-color: var(--ring)` (subtle, optional) | n/a       | n/a               | `border-color 150ms`               |
| Sidebar nav          | `bg-sidebar-accent`            | `ring-2 ring-sidebar-ring` | active = white bg | `background-color 150ms`           |
| Input                | `border-color: var(--ring)/50` | `border-ring ring-ring/50 ring-[3px]` | n/a    | `border-color 150ms, box-shadow 150ms` |
| Table row            | `bg-muted/50`                  | n/a                        | `bg-muted`        | `background-color 100ms`           |

**Standard transition:** `--default-transition-duration: 0.15s`, `--default-transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1)` (Tailwind's `ease-in-out`). Use `transition-all` sparingly — prefer `transition-colors` or `transition-[background-color,border-color]` for performance.

**Easing tokens:**
```css
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
```

**Focus discipline:** never disable outline globally. Use `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` per architecture rules §14.

---

## 7. Ready-to-paste artifacts

### 7.1 `/libs/@cortex/styles/tokens.css`

```css
@import "tailwindcss/base";
@import "tailwindcss/components";
@import "tailwindcss/utilities";

@layer base {
  :root {
    /* Surfaces */
    --background: 0 0% 100%;
    --foreground: 0 0% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 3.9%;

    /* Brand / primary */
    --primary: 0 0% 9%;
    --primary-foreground: 0 0% 98%;

    /* Neutrals */
    --secondary: 0 0% 96.1%;
    --secondary-foreground: 0 0% 9%;
    --muted: 0 0% 96.1%;
    --muted-foreground: 0 0% 45.1%;
    --accent: 0 0% 96.1%;
    --accent-foreground: 0 0% 9%;

    /* Semantic state */
    --destructive: 0 84.2% 45.5%;
    --destructive-foreground: 0 0% 98%;
    --success: 142 71% 45%;
    --success-foreground: 142 76% 18%;
    --warning: 36 100% 50%;
    --warning-foreground: 36 100% 22%;
    --info: 225 84% 49%;
    --info-foreground: 225 84% 95%;

    /* Borders / focus */
    --border: 0 0% 89.8%;
    --input: 0 0% 89.8%;
    --ring: 0 0% 63.1%;

    /* Sidebar (separate scope) */
    --sidebar: 0 0% 96.1%;
    --sidebar-foreground: 240 4.5% 34.5%;
    --sidebar-primary: 0 0% 9%;
    --sidebar-primary-foreground: 0 0% 98%;
    --sidebar-accent: 0 0% 100%;
    --sidebar-accent-foreground: 0 0% 9%;
    --sidebar-border: 0 0% 89.8%;
    --sidebar-ring: 0 0% 63.1%;

    /* Charts */
    --chart-1: 18 100% 48%;
    --chart-2: 175 100% 29%;
    --chart-3: 196 72% 23%;
    --chart-4: 44 100% 50%;
    --chart-5: 36 100% 50%;

    /* Radius scale */
    --radius: 0.625rem;
    --radius-xs: 0.25rem;
    --radius-sm: 0.375rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.625rem;
    --radius-xl: 0.875rem;
    --radius-2xl: 1rem;

    /* Layout */
    --sidebar-width: 15rem;
    --sidebar-width-icon: 3rem;
    --header-height: 3.5rem;
  }

  .dark {
    --background: 0 0% 3.9%;
    --foreground: 0 0% 98%;
    --card: 0 0% 9%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 9%;
    --popover-foreground: 0 0% 98%;

    --primary: 0 0% 89.8%;
    --primary-foreground: 0 0% 9%;

    --secondary: 0 0% 14.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 14.9%;
    --muted-foreground: 0 0% 63.1%;
    --accent: 0 0% 14.9%;
    --accent-foreground: 0 0% 98%;

    --destructive: 0 100% 70%;
    --destructive-foreground: 0 0% 98%;
    --success: 160 100% 37%;
    --success-foreground: 0 0% 98%;
    --warning: 36 100% 50%;
    --warning-foreground: 0 0% 9%;
    --info: 225 84% 49%;
    --info-foreground: 0 0% 98%;

    --border: 0 0% 14.9%;
    --input: 0 0% 14.9%;
    --ring: 0 0% 45.1%;

    --sidebar: 0 0% 9%;
    --sidebar-foreground: 0 0% 98%;
    --sidebar-primary: 0 0% 89.8%;
    --sidebar-primary-foreground: 0 0% 9%;
    --sidebar-accent: 0 0% 14.9%;
    --sidebar-accent-foreground: 0 0% 98%;
    --sidebar-border: 0 0% 14.9%;
    --sidebar-ring: 0 0% 45.1%;
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "cv11", "ss01", "ss03";
    -webkit-font-smoothing: antialiased;
  }
}
```

### 7.2 `tailwind.config.ts` — theme extension

```ts
import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./libs/@cortex/ui/**/*.{ts,tsx}",
  ],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      fontFamily: {
        sans: ["Inter", ...fontFamily.sans],
        mono: [...fontFamily.mono],
      },
      fontSize: {
        // Match reference: tighter sm gives the dense feel
        sm: ["0.813rem", { lineHeight: "1.143" }],
      },
      letterSpacing: {
        tighter: "-0.05em",
        tight: "-0.025em",
        normal: "0",
        wide: "0.025em",
      },
      transitionTimingFunction: {
        "in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
        out: "cubic-bezier(0, 0, 0.2, 1)",
      },
      transitionDuration: {
        DEFAULT: "150ms",
      },
      width: {
        sidebar: "var(--sidebar-width)",
        "sidebar-icon": "var(--sidebar-width-icon)",
      },
      height: {
        header: "var(--header-height)",
      },
      // Add radix accordion keyframes/animations as standard shadcn boilerplate
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

### 7.3 `components.json` (shadcn/ui CLI config)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "libs/@cortex/styles/tokens.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@cortex/ui/components",
    "utils": "@cortex/ui/lib/utils",
    "ui": "@cortex/ui/components",
    "hooks": "@cortex/ui/hooks"
  },
  "iconLibrary": "lucide"
}
```

**Why `style: "new-york"`:** matches the reference's tight typography + minimal shadows (vs `default` which is more rounded/airy). Critical for the look.

**Why `baseColor: "neutral"`:** reference is pure neutral spine. Slate/zinc/gray would shift tone. Neutral is the closest match.

**Why `cssVariables: true`:** required for theme switching per architecture rules §4 (light/dark without rebuild).

---

## 8. Risk & next steps

**Risk if used as-is:** the palette is *very* monochrome. Three risks:

1. **Visual flatness across tiles.** When IDP, future kafelek 2, kafelek 3 all render the same neutral chrome, users will struggle to know which app they're in. Mitigation: per-tile **accent color override** (single hue swap on `--info` or a new `--brand` token), not chrome change.
2. **Status badge palette is undersized.** Reference exposes only 2 (Delivery / Transfer). IDP will need ~6-8 (Draft, Importing, Classified, NeedsReview, Verified, Allocated, Failed, Cancelled). Defined in §5.5; verify with Patryk against actual IDP state machine.
3. **No motion design captured.** Reference is mostly static. We'll need to define stepper transitions, document loading states, drag-and-drop feedback ourselves. Use `framer-motion` per architecture (sec. interaction) — keep durations at `150-250ms`, `ease-in-out`, no bounce/spring (boring is professional in B2B).

**Next steps:**
1. Implement `/libs/@cortex/styles/tokens.css` exactly as §7.1.
2. Wire `tailwind.config.ts` per §7.2.
3. Run `pnpm dlx shadcn@latest init` with §7.3 config.
4. Build `<Badge>` variants matching §5.5 mapping (success/info/warning/destructive/neutral).
5. Decide per-tile brand accent strategy before second tile starts.
