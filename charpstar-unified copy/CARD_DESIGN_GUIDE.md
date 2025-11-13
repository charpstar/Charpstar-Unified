# Card Design Enhancement Guide

This guide demonstrates how to use the new enhanced card design utilities following modern UI/UX principles with depth, layering, and subtle animations.

## Overview

The enhanced design system uses:

- **Layered surfaces** with varying shades of the same color
- **Multi-layered shadows** for realistic depth
- **Subtle glows and highlights** for light interaction
- **Smooth hover transitions** for better interactivity
- **Gradient overlays** for dimensional effects

All utilities use CSS variables from `globals.css` and work seamlessly in both light and dark modes.

## Available Surface Layers

```tsx
// Four levels of surface depth (lighter = higher)
<div className="surface-base">      // Base background
<div className="surface-raised">    // Slightly elevated
<div className="surface-elevated">  // More elevated
<div className="surface-floating">  // Highest level
```

## Shadow Depths

```tsx
// Progressive shadow depths
<div className="shadow-depth-sm">   // Minimal shadow
<div className="shadow-depth-md">   // Medium shadow (2 layers)
<div className="shadow-depth-lg">   // Large shadow (3 layers) + subtle border
<div className="shadow-depth-xl">   // Extra large (3 layers) + border
<div className="shadow-depth-2xl">  // Maximum depth (3 layers) + border
<div className="shadow-depth-inner"> // Inset shadow for pressed states
```

## Enhanced Card Styles

### 1. Basic Enhanced Card

```tsx
<Card className="card-enhanced rounded-xl overflow-hidden">
  <CardHeader>
    <CardTitle>Enhanced Card</CardTitle>
  </CardHeader>
  <CardContent>
    <!-- Content here -->
  </CardContent>
</Card>
```

**Features:**

- Elevated surface background
- Light border with subtle highlight
- Medium shadow depth
- Shine gradient overlay on hover
- Lifts up 4px on hover with larger shadow
- Border becomes more prominent on hover

### 2. Layered Card Design

```tsx
<Card className="card-layered rounded-xl">
  <CardHeader className="relative z-10">
    <CardTitle>Layered Card</CardTitle>
  </CardHeader>
  <CardContent className="relative z-10">
    <!-- Content here -->
  </CardContent>
</Card>
```

**Features:**

- Depth gradient overlay
- Inset highlight border at top
- Medium shadow with border
- Perfect for main content cards

### 3. Stat Card

```tsx
<div className="stat-card rounded-xl p-6">
  <div className="icon-container-elevated p-3 rounded-xl mb-4 inline-flex">
    <Icon className="h-6 w-6" />
  </div>
  <h3 className="text-2xl font-bold">$1,234</h3>
  <p className="text-sm text-muted-foreground">Total Revenue</p>
</div>
```

**Features:**

- Subtle shadow initially
- Lifts 2px on hover
- Background brightens on hover
- Border highlight appears
- Perfect for dashboard statistics

### 4. Interactive Elements

```tsx
<button className="interactive-highlight rounded-lg px-4 py-2">Click Me</button>
```

**Features:**

- Raised surface background
- Subtle border
- Elevates background on hover
- Border highlight on hover
- Slight scale down on click with inset shadow

## Hover Effects

### Lift Effect

```tsx
<div className="hover-lift rounded-xl p-4">
  <!-- Lifts 4px with XL shadow -->
</div>

<div className="hover-lift-subtle rounded-xl p-4">
  <!-- Lifts 2px with large shadow -->
</div>
```

### Scale Effect

```tsx
<div className="hover-scale rounded-xl p-4">
  <!-- Scales to 102% -->
</div>

<div className="hover-scale-lift rounded-xl p-4">
  <!-- Lifts 3px + scales to 102% + 2XL shadow -->
</div>
```

### Glow Effect

```tsx
<div className="hover-glow rounded-xl p-4">
  <!-- Adds glow effect on hover -->
</div>
```

## Gradient Overlays

```tsx
// Subtle shine from top-left
<div className="relative">
  <div className="absolute inset-0 gradient-shine rounded-xl pointer-events-none" />
  <!-- Content -->
</div>

// Depth gradient (dark to light bottom)
<div className="relative">
  <div className="absolute inset-0 gradient-depth rounded-xl pointer-events-none" />
  <!-- Content -->
</div>

// Subtle top gradient
<div className="relative">
  <div className="absolute inset-0 gradient-subtle rounded-xl pointer-events-none" />
  <!-- Content -->
</div>
```

## Glow Effects

```tsx
<div className="glow-sm rounded-xl">  // Small glow + border highlight
<div className="glow-md rounded-xl">  // Medium glow + border highlight
<div className="glow-lg rounded-xl">  // Large glow + border highlight
```

## Border Highlights

```tsx
<div className="border border-light">      // Subtle light border
<div className="border border-highlight">  // Prominent highlight border
```

## Complete Card Example

Here's a complete example combining multiple techniques:

```tsx
<Card className="card-enhanced rounded-xl overflow-hidden">
  {/* Background decorations */}
  <div className="absolute inset-0 opacity-5 bg-grid-pattern" />
  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-full transform translate-x-16 -translate-y-16" />

  <CardHeader className="relative z-10 border-b border-light">
    <div className="flex items-center gap-3">
      <div className="icon-container-elevated p-3 rounded-xl">
        <Package className="h-5 w-5 text-primary" />
      </div>
      <CardTitle className="text-xl font-bold">Client Dashboard</CardTitle>
    </div>
  </CardHeader>

  <CardContent className="relative z-10 p-6">
    <div className="grid grid-cols-3 gap-4">
      <div className="stat-card rounded-xl p-5">
        <div className="flex items-center justify-center mb-3">
          <div className="icon-container p-2 rounded-full">
            <CheckCircle className="h-5 w-5 text-success" />
          </div>
        </div>
        <p className="text-2xl font-bold text-center">42</p>
        <p className="text-xs text-muted-foreground text-center mt-1">
          Completed
        </p>
      </div>

      <div className="stat-card rounded-xl p-5">
        <div className="flex items-center justify-center mb-3">
          <div className="icon-container p-2 rounded-full">
            <Clock className="h-5 w-5 text-warning" />
          </div>
        </div>
        <p className="text-2xl font-bold text-center">18</p>
        <p className="text-xs text-muted-foreground text-center mt-1">
          In Progress
        </p>
      </div>

      <div className="stat-card rounded-xl p-5">
        <div className="flex items-center justify-center mb-3">
          <div className="icon-container p-2 rounded-full">
            <AlertCircle className="h-5 w-5 text-error" />
          </div>
        </div>
        <p className="text-2xl font-bold text-center">5</p>
        <p className="text-xs text-muted-foreground text-center mt-1">
          Pending
        </p>
      </div>
    </div>
  </CardContent>
</Card>
```

## Best Practices

### 1. Layering Hierarchy

- Use `surface-base` for page backgrounds
- Use `surface-raised` for first-level cards
- Use `surface-elevated` for interactive elements within cards
- Use `surface-floating` for modals, dropdowns, tooltips

### 2. Shadow Usage

- Small shadows for subtle elevation (buttons, inputs)
- Medium shadows for cards
- Large shadows for important cards or hover states
- XL/2XL shadows for floating elements or dramatic hover effects

### 3. Hover States

- Use `hover-lift-subtle` for most cards
- Use `hover-lift` for primary actions or featured content
- Use `hover-scale-lift` for cards that should draw maximum attention
- Combine with border-highlight for extra emphasis

### 4. Icon Containers

- Use `icon-container` for basic icon backgrounds
- Use `icon-container-elevated` for emphasized icons
- Always pair with appropriate colors and rounded corners

### 5. Gradients

- Use `gradient-shine` for hover effects (with opacity transition)
- Use `gradient-depth` for static depth enhancement
- Use `gradient-subtle` for very minimal effects
- Apply with `pointer-events-none` and absolute positioning

## Dark Mode Behavior

All utilities automatically adjust for dark mode:

- Surfaces become progressively lighter shades of dark
- Shadows become deeper and more prominent
- Glows include subtle white highlights
- Gradients adjust to maintain proper contrast

## Migration Guide

### Before (Old Style)

```tsx
<Card className="border-0 shadow-xl hover:scale-[1.02]">
```

### After (Enhanced Style)

```tsx
<Card className="card-enhanced rounded-xl">
```

### Before (Manual Layering)

```tsx
<div className="bg-muted/50 border border-border shadow-lg">
```

### After (Utility Classes)

```tsx
<div className="surface-raised border border-light shadow-depth-lg">
```

## Performance Notes

- All transitions use GPU-accelerated properties (transform, opacity)
- Cubic-bezier easing provides smooth, natural motion
- Hover effects are optimized for 60fps
- Gradients use absolute positioning to avoid layout shifts
