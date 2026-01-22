# UI/UX Design Guidelines

This document captures the consistent design patterns and behaviors used throughout the Book Review app.

---

## 1. Glassmorphic Styling

The app uses a consistent glassmorphic (frosted glass) effect for cards, panels, and interactive elements.

### Standard Glassmorphic Style
```typescript
const glassmorphicStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.6)',
  backdropFilter: 'blur(9.4px)',
  WebkitBackdropFilter: 'blur(9.4px)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
};
```

### Blue Glassmorphic Style (Primary Actions)
Used for primary action buttons like Follow, Add, and Submit.
```typescript
const blueGlassmorphicStyle: React.CSSProperties = {
  background: 'rgba(59, 130, 246, 0.85)',
  backdropFilter: 'blur(9.4px)',
  WebkitBackdropFilter: 'blur(9.4px)',
  border: '1px solid rgba(59, 130, 246, 0.3)',
};
```

### Usage
- Cards and containers: `rounded-xl` + glassmorphic style
- Input fields: Transparent background with glassmorphic container
- Modal backgrounds: Glassmorphic with higher opacity

---

## 2. Skeleton Loading States

When content is loading, display skeleton placeholders with a pulsing opacity animation.

### Implementation
```tsx
<motion.div
  animate={{ opacity: [0.5, 0.8, 0.5] }}
  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
  className="rounded-xl p-4"
  style={glassmorphicStyle}
>
  <div className="w-full h-4 bg-slate-300/50 rounded animate-pulse" />
</motion.div>
```

### Key Properties
- **Opacity animation**: `[0.5, 0.8, 0.5]` - creates subtle pulsing effect
- **Duration**: 2 seconds per cycle
- **Easing**: `easeInOut` for smooth transitions
- **Placeholder color**: `bg-slate-300/50` (50% opacity slate)
- **Container**: Same glassmorphic style as loaded content

### When to Use
- Profile data loading
- Bookshelf items loading
- List items (following, usage logs)
- AI-generated content (facts, summaries)

---

## 3. Button Styles

### Primary Button (Blue Solid)
```tsx
className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all active:scale-95"
```

### Primary Button (Blue Glassmorphic)
```tsx
className="text-white font-bold rounded-full transition-all active:scale-95"
style={blueGlassmorphicStyle}
```

### Secondary Button (Glassmorphic)
```tsx
className="text-slate-700 font-bold rounded-lg transition-all hover:opacity-80 active:scale-95"
style={glassmorphicStyle}
```

### Icon Button
```tsx
className="w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-transform"
```

### Common Properties
- **Press feedback**: `active:scale-95` for tap feedback
- **Hover state**: `hover:opacity-80` or `hover:bg-blue-700`
- **Transition**: `transition-all` or `transition-transform`
- **Font weight**: `font-bold`
- **Border radius**: `rounded-lg` for rectangular, `rounded-full` for circular

---

## 4. Animation Patterns

### Page Transitions (Framer Motion)
```tsx
<motion.div
  initial={{ opacity: 0, x: 20 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -20 }}
  transition={{ duration: 0.3, ease: "easeInOut" }}
>
```

### Element Entry Animation
```tsx
<motion.div
  initial={{ opacity: 0, y: -10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
```

### Spring Animation (Modals/Sheets)
```tsx
transition={{ type: 'spring', damping: 25, stiffness: 300, duration: 0.4 }}
```

### Tap Feedback
```tsx
<motion.button whileTap={{ scale: 0.7 }}>
```

### Standard Transition Duration
- Fast (immediate feedback): `0.2s`
- Standard (most transitions): `0.3s`
- Slow (page transitions): `0.4s`
- Loading pulse: `2s` (infinite)

---

## 5. Color Palette

### Primary Colors
- **Blue 600**: `#2563eb` - Primary actions, links
- **Blue 700**: `#1d4ed8` - Hover states

### Text Colors
- **Slate 950**: `#020617` - Primary text (headers)
- **Slate 800**: `#1e293b` - Body text
- **Slate 700**: `#334155` - Secondary text
- **Slate 600**: `#475569` - Muted text
- **Slate 500**: `#64748b` - Placeholder text

### Background Colors
- **White/60%**: `rgba(255, 255, 255, 0.6)` - Glassmorphic cards
- **Slate 300/50%**: `rgba(203, 213, 225, 0.5)` - Skeleton placeholders
- **Slate 100**: `#f1f5f9` - Icon containers

### Accent Colors
- **Amber 400**: `#fbbf24` - Star ratings
- **Red/Pink**: Error states, delete actions

---

## 6. Typography

### Font Families
- **Primary**: System default (sans-serif)
- **Display**: Bebas Neue, Oswald, Antonio, Archivo Narrow (for covers)

### Text Sizes
- `text-xs`: 12px - Labels, captions, metadata
- `text-sm`: 14px - Body text, button labels
- `text-base`: 16px - Standard body
- `text-lg`: 18px - Subheadings
- `text-xl` and up: Headings

### Common Patterns
- **Headers**: `font-bold text-slate-900`
- **Body**: `text-slate-700` or `text-slate-800`
- **Captions**: `text-xs text-slate-600 uppercase tracking-wider`
- **Links**: `text-blue-600 hover:underline`

---

## 7. Spacing & Layout

### Border Radius
- **Cards/Panels**: `rounded-xl` (12px)
- **Buttons**: `rounded-lg` (8px) or `rounded-full`
- **Inputs**: `rounded-lg` (8px)
- **Small elements**: `rounded` (4px)

### Padding
- **Cards**: `p-4` (16px)
- **Buttons**: `px-4 py-2` or `px-3 py-1.5`
- **Containers**: `p-6` (24px)

### Gaps
- **List items**: `gap-3` or `gap-4`
- **Button groups**: `gap-2`
- **Icon + text**: `gap-2`

---

## 8. Interactive States

### Hover
- Buttons: `hover:opacity-80` or `hover:bg-[darker]`
- Links: `hover:underline`
- Cards: Subtle lift with shadow increase

### Active/Pressed
- Scale down: `active:scale-95`
- Framer Motion: `whileTap={{ scale: 0.7 }}`

### Focus
- Use `focus:outline-none` with custom focus styles when needed
- Maintain accessibility with visible focus indicators

### Disabled
- Reduced opacity: `opacity-50`
- No pointer events: `pointer-events-none`

---

## 9. Scrolling Behavior

### Hidden Scrollbars
```css
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

### iOS-like Momentum Scrolling
```css
.ios-scroll {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: auto; /* Bounce at edges */
  scroll-behavior: smooth;
}
```

---

## 10. Auto-Save Pattern

### Debounced Save
Save changes automatically after user stops typing.

```typescript
useEffect(() => {
  const timeout = setTimeout(() => {
    saveChanges(value);
  }, 500); // 500ms debounce

  return () => clearTimeout(timeout);
}, [value]);
```

### Visual Feedback
- No explicit save button needed
- Optional: Subtle "Saved" indicator that fades after confirmation

---

## 11. Modal/Sheet Pattern

### Bottom Sheet Animation
```tsx
<motion.div
  initial={{ y: "100%" }}
  animate={{ y: 0 }}
  exit={{ y: "100%" }}
  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
>
```

### Overlay
```tsx
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  className="fixed inset-0 bg-black/50"
  onClick={onClose}
/>
```

---

## 12. Image Handling

### CachedImage Component
Use the `CachedImage` component for all external images to enable:
- Browser cache API storage
- In-memory blob URL caching
- Graceful fallback handling
- Lazy loading by default

```tsx
<CachedImage
  src={imageUrl}
  alt="Description"
  className="w-full h-full object-cover"
  fallback={<PlaceholderIcon />}
/>
```

---

## 13. Sort/Filter Controls

### Cycle Button Pattern
Single button that cycles through sort options on click.

```tsx
<button
  onClick={() => {
    const options = ['recent_desc', 'recent_asc', 'name_asc', 'name_desc'];
    const nextIndex = (currentIndex + 1) % options.length;
    setSortOrder(options[nextIndex]);
  }}
  className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all text-slate-700 hover:opacity-80 active:scale-95"
  style={glassmorphicStyle}
>
  <span>{sortLabel}</span>
</button>
```

### Sort Labels
- Recent ↓ (descending)
- Recent ↑ (ascending)
- Name A-Z
- Name Z-A

---

## 14. Empty States

Show helpful messages when no content is available.

```tsx
<div className="rounded-xl p-4" style={glassmorphicStyle}>
  <p className="text-xs text-slate-600 text-center">
    No items found
  </p>
</div>
```

---

## 15. Timestamps

### Format
Display timestamps in a human-readable format with both date and time when relevant.

```typescript
// For recent items (same day)
"Today at 3:45 PM"

// For older items
"Jan 15, 2024 at 10:30 AM"
```

### Note Timestamps
- Show creation timestamp as a fixed header
- Format: `MMM D, YYYY h:mm A`

---

## Quick Reference

| Element | Border Radius | Background | Text Color |
|---------|--------------|------------|------------|
| Card | `rounded-xl` | Glassmorphic | `text-slate-800` |
| Button Primary | `rounded-lg` | Blue Glassmorphic | `text-white` |
| Button Secondary | `rounded-lg` | Glassmorphic | `text-slate-700` |
| Icon Button | `rounded-full` | Varies | Varies |
| Input | `rounded-lg` | Transparent | `text-slate-800` |
| Skeleton | `rounded` | `bg-slate-300/50` | N/A |
