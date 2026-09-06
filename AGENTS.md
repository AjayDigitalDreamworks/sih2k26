# UI/UX Development Rules

## Core Rule
Never redesign or alter the existing UI/UX unless explicitly requested.

## Before Making Changes
- Inspect the existing components and styling first.
- Understand the current design system before editing.
- Reuse existing components, styles, colors, typography, spacing and patterns.
- Follow the existing visual language exactly.

## When Implementing Features
- Change only what is necessary for the requested task.
- Do not modify unrelated components.
- Do not replace existing layouts with your own design.
- Do not introduce new colors, fonts, shadows, borders or spacing styles unless required.
- Preserve responsive behavior.
- Preserve existing animations and interactions unless the task requires changing them.

## Code Changes
- Prefer small, targeted changes.
- Reuse existing code instead of duplicating it.
- Do not refactor unrelated code.
- Do not rename or restructure components without a reason.
- Before finishing, check that previously existing screens still look and behave the same.

## UI Consistency
Every new UI element must look like it belongs to the existing application.

Match:
- colors
- typography
- spacing
- border radius
- shadows
- buttons
- cards
- inputs
- icons
- responsive breakpoints
- animations
- layout patterns

## Priority
Existing project design > AI assumptions.

If something is ambiguous, preserve the existing behavior/design instead of inventing a new one.
