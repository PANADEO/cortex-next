# Cortex Frontend — Look & Feel Review vs. Reference

> **Reference:** https://shadcnuidashboard.com/logistics
> **Local app:** http://localhost:3000 (dashboard / packages / pkg detail / import / audit-log)
> **Captured:** 2026-04-20
> **Tokens source of truth:** `/Users/cez/P/new_cortex/cortex_frontend/docs/work/design-tokens.md`
> **Method:** side-by-side screenshots at 1460×812, zoomed inspection of sidebar, topbar, tables, badges, cards.

## TL;DR

**Overall score: 34/50** — solid foundation, right palette, right spacing system. Three big chrome gaps drag the score down: (1) the topbar is essentially empty vs. a richly-populated reference header, (2) cards ship with a default drop `shadow` which contradicts the "border-only, shadow-light" discipline, (3) status badges are larger and more "outlined" than the reference's tight pill. Fix those three and the number jumps to ~42.

---

## 1. Side-by-side comparison

| #   | Dimension            | Reference                                                                                                                                  | Ours                                                                                                                                                                               | Score | Gap                                                                                                                                                                                                   |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Color palette**    | Monochrome neutral spine, 2 badge colors (green/blue), black primary                                                                       | Identical tokens (tokens.css matches), adds warning/destructive/neutral variants                                                                                                   | 5     | None — this is the win.                                                                                                                                                                               |
| 2   | **Typography**       | Plus Jakarta Sans, `--text-sm: 0.813rem`, tight tracking, `font-medium` for buttons/active nav                                             | Inter (intentional swap), same `sm=0.813`, but page titles are `text-2xl` and feel heavier than ref's compact `#9835` heading                                                      | 4     | Page header H1 too large; ref's page titles sit at ~`text-xl`/`font-semibold` inside the content, not as a standalone hero.                                                                           |
| 3   | **Spacing & rhythm** | Very tight: `py-3` cells, `p-4` cards, `gap-1.5` everywhere                                                                                | Mostly tight but `PageHeader` uses `px-8 py-6 gap-3` — too airy vs. ref's compact `Load ID: #9835` + buttons on one row                                                            | 3     | Page headers eat 120px of vertical space; ref eats ~60px.                                                                                                                                             |
| 4   | **Sidebar**          | 240px, `#f5f5f5`, items `h-8 px-2`, active = white card-pop (`rounded-md`), sections "Main"/"Components", "Download Dashboard" footer CTA  | 240px, same bg, `h-8` items, active = white — matches spec ✓. "COMING SOON" section treated same as main, no footer CTA                                                            | 5     | Essentially correct. Minor: sidebar foreground in ref is `#54545c` (cool gray); our `text-sidebar-foreground/80` reads pure neutral. Check `--sidebar-foreground` is `240 4.5% 34.5%` not `0 0% 45%`. |
| 5   | **Topbar / header**  | 56px, breadcrumbs left + sidebar-toggle, global `⌘K` search centered, mail + notification + theme-toggle + avatar right                    | 56px height ✓, breadcrumb placeholder empty, avatar "DU" cut off at far right edge, no search, no icons                                                                            | 1     | Biggest single gap. The topbar is the first thing users see — ours is blank.                                                                                                                          |
| 6   | **Cards**            | Border only, no shadow, `rounded-xl` (14px), `p-6`                                                                                         | `rounded-xl` ✓, `p-6` ✓, **but `ui/card.tsx` has `shadow` class baked in** → default shadow drops a halo around every metric card and detail card                                  | 3     | Remove the `shadow` from the base Card className.                                                                                                                                                     |
| 7   | **Data tables**      | Row `~52px`, header `text-xs uppercase tracking-wide text-muted-foreground`, no zebra, hover `bg-muted/50`, 1px row borders, no outer card | Row `~48px` (py-3+content), header matches ✓, no zebra ✓, hover matches ✓, **wrapped in `rounded-lg border bg-card`** — ref keeps tables flush with content, no outer bounding box | 4     | Drop the outer `rounded-lg border bg-card` wrapper on `data-table.tsx` — or make it optional. Ref tables bleed into the page.                                                                         |
| 8   | **Status badges**    | Solid fill (`#dbfce7`/`#008236` or `#dbeafe`/`#1447e6`), `4px` radius, `2px 10px` padding, **no border**, `12px` font, **no icon**         | `h-6 px-2 rounded-md` (8px radius), `bg-*/10 text-* border`, **icon always present**                                                                                               | 2     | Too tall, too rounded, too outlined, icon makes them feel noisy. Ref badges are flat tight pills.                                                                                                     |
| 9   | **Buttons**          | `h-9 px-3 rounded-md` (8px), `shadow: none`, `ring-2 ring-offset-2` focus                                                                  | `h-9 rounded-md` ✓ but **`shadow` on default** and **`shadow-sm` on destructive/outline/secondary**; focus is `ring-1` no offset                                                   | 3     | Strip shadows from all variants, bump focus ring to `ring-2 ring-offset-2`.                                                                                                                           |
| 10  | **Overall density**  | Extremely tight — single-screen fits sidebar + 2 shipment cards + detail panel + stops column                                              | Dashboard fits 6 metric cards in a row + 5-row table — good density, but page header steals vertical space                                                                         | 4     | Density is close; kill page-header padding and it matches.                                                                                                                                            |

**Total: 34 / 50**

---

## 2. Discrepancies with concrete fixes

### 2.1 `PageHeader` is too airy (highest impact)

**File:** `libs/@cortex/ui/src/components/page-header.tsx`
**Current:** `px-8 py-6 gap-3`, title `text-2xl font-semibold`
**Fix:** drop to `px-6 py-4 gap-2`, title `text-xl font-semibold`. Ref never renders a hero-title page header — the page label lives in breadcrumbs and the in-content card/section heading is what draws the eye.

### 2.2 Cards ship with a default shadow

**File:** `libs/@cortex/ui/src/components/ui/card.tsx` line 12
**Current:** `"rounded-xl border bg-card text-card-foreground shadow"`
**Fix:** remove the trailing `shadow`. Reference is border-only. Expose `shadow-sm` as an opt-in via a prop if needed (`elevated?: boolean`), but never as default.

### 2.3 Buttons carry shadows in every variant

**File:** `libs/@cortex/ui/src/components/ui/button.tsx`
**Current:** `default: "... shadow ..."`, `destructive: "... shadow-sm"`, `outline: "... shadow-sm"`, `secondary: "... shadow-sm"`
**Fix:** remove all `shadow*` classes from the variants. Ref explicitly has no button shadows.

### 2.4 Button focus ring is too thin

**Same file**
**Current:** `focus-visible:ring-1 focus-visible:ring-ring` in the base className
**Fix:** change to `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` — matches design-tokens.md §6 and the reference's 3px focus outline.

### 2.5 Status badges too large, wrong radius, bordered

**File:** `libs/@cortex/ui/src/components/status-badge.tsx`
**Current:** `"inline-flex items-center gap-1.5 rounded-md border font-medium"` + `"h-6 px-2 text-xs"`
**Fix:**

- `rounded-md` → `rounded-[4px]` (or add `rounded-xs` in tailwind.config and use it)
- remove `border` class
- drop `h-6`, use `py-0.5 px-2.5` (2px 10px) instead
- change the per-status classes to solid pairs: `bg-emerald-100 text-emerald-800`, `bg-blue-100 text-blue-700`, `bg-amber-100 text-amber-800`, `bg-red-100 text-red-700`, `bg-neutral-100 text-neutral-700` — exactly per design-tokens.md §5.5
- make `showIcon` default to `false`; reference has no icons in badges

### 2.6 Topbar is empty

**File:** `app/idp/app/(main)/layout.tsx` lines 39-46
**Current:** `<div className="text-sm text-muted-foreground">{/* placeholder */}</div>` + `<UserMenu />`
**Fix:** build out a real topbar. Minimum viable parity with reference:

- left: `SidebarTrigger` icon (not needed yet if sidebar is always open, but hold the slot) + breadcrumbs from the page (move breadcrumb rendering OUT of `PageHeader` and UP into the topbar — ref puts breadcrumbs in the topbar, not in a page-level block)
- center: `<kbd>⌘K</kbd>` command palette stub (even non-functional pill looks intentional)
- right: mail icon + notifications bell + theme toggle + `UserMenu`
- avatar is currently clipped (`DU` is cut off) because the topbar `px-6` + content padding miscalculates — give the header `px-4`

### 2.7 Tables wrapped in a card-ish container

**File:** `libs/@cortex/ui/src/components/data-table.tsx` line 43
**Current:** `<div className="overflow-hidden rounded-lg border border-border bg-card">`
**Fix:** either drop the wrapper entirely or make it opt-in via a `bordered?: boolean` prop (default `false`). Reference tables on both Logistics and any shadcn dashboard layout are flush — the page surface IS the table's surface. The outer border makes ours look nested.

### 2.8 Sidebar brand block has a border-bottom

**File:** `libs/@cortex/ui/src/components/tile-menu.tsx` line 35
**Current:** `"flex h-header items-center border-b border-sidebar-border px-5"`
**Observation:** reference sidebar brand has **no** border-bottom; the whole sidebar reads as one continuous surface. Fix: remove `border-b border-sidebar-border` from the brand container. Keeps visual continuity with the nav.

### 2.9 Active sidebar item uses `bg-sidebar-accent` not pure white

**Same file, line 60**
**Current:** `"bg-sidebar-accent text-sidebar-accent-foreground font-medium"`
**Check:** design-tokens.md §2.3 sets `--sidebar-accent: #ffffff` in light mode, so `bg-sidebar-accent` SHOULD be white. Verify in `libs/@cortex/styles/tokens.css` that the token is actually `0 0% 100%` for `--sidebar-accent` in light; our screenshot shows it rendering correctly (active = white card on gray). Leave — this is right.

### 2.10 Sidebar missing footer CTA slot use

**File:** `app/idp/app/(main)/layout.tsx` line 33
**Current:** `footerSlot={<p ...>IDP v0.1 · prototype</p>}`
**Observation:** reference fills the sidebar footer with a prominent black `Download Dashboard` button. For Cortex that's our chance to house e.g. a "New import" or "Help / docs" quick action, or leave it as brand footer. Low priority, but the muted text footer feels afterthought-y.

---

## 3. Top 3 quickest wins (do these first)

1. **Kill the shadow on Card + Button variants.** One line in `ui/card.tsx`, four lines in `ui/button.tsx`. Instant "flat modern" look that matches the reference's shadow-light discipline. ~5 min, visible win everywhere.

2. **Compress `PageHeader`.** Change `px-8 py-6 gap-3` → `px-6 py-4 gap-2` and `text-2xl` → `text-xl`. Every page shrinks by ~60px at the top, content density jumps noticeably. Dashboard metric cards rise into the first viewport fold. ~2 min.

3. **Fix status badges.** Drop the border, drop the icon default, switch radius to `4px`, use solid pastel pairs per design-tokens.md §5.5. Ref's badges are what makes its tables look "designed" rather than "UI-kit default". ~10 min in `status-badge.tsx` only.

After those three: **score jumps from 34 → ~42**. Topbar buildout (fix 2.6) is the next phase — it's a half-day of work, not a quick win, but it's the single biggest remaining gap.

---

## 4. Not scored but worth noting

- **Demo user avatar "DU" is clipped** on the right edge in every screen. Content container overflows viewport — `overflow-x` issue on `main` or the topbar is extending past `100vw`. Inspect `app-shell.tsx` — the `<header>` has `px-6` but no `max-w` handling and no `overflow-hidden` on the outer flex container.
- **No theme toggle wired up** yet. Reference has a sun/moon toggle top-right. Tokens file already defines full dark palette — this is free once topbar lands.
- **Font-feature-settings in design-tokens.md §7.1 mentions `"cv11", "ss01", "ss03"`** for Inter; verify these are applied in `libs/@cortex/styles/tokens.css`. They add the subtle "designed" typographic touches (single-story a, different l). Check rendering — if the lowercase `l` looks like `1` in table rows, the features aren't loading.
- **Breadcrumb ("IDP / Dashboard") inside the page area**, not in the topbar. Reference has breadcrumb in the topbar. Move it up once the topbar exists.

---

## 5. Files to touch (in priority order)

| Priority | File                                              | Change                                                   |
| -------- | ------------------------------------------------- | -------------------------------------------------------- |
| P0       | `libs/@cortex/ui/src/components/ui/card.tsx`      | Remove `shadow` from base className                      |
| P0       | `libs/@cortex/ui/src/components/ui/button.tsx`    | Remove `shadow*` from all variants; upgrade focus ring   |
| P0       | `libs/@cortex/ui/src/components/status-badge.tsx` | Pills: 4px radius, no border, solid fills, optional icon |
| P0       | `libs/@cortex/ui/src/components/page-header.tsx`  | Compress to `px-6 py-4 gap-2`, title `text-xl`           |
| P1       | `app/idp/app/(main)/layout.tsx`                   | Build real topbar (breadcrumbs + search stub + actions)  |
| P1       | `libs/@cortex/ui/src/components/data-table.tsx`   | Make outer wrapper border opt-in                         |
| P2       | `libs/@cortex/ui/src/components/tile-menu.tsx`    | Remove brand `border-b`                                  |
| P2       | `libs/@cortex/ui/src/components/app-shell.tsx`    | Investigate topbar `px-6` + avatar clipping              |
