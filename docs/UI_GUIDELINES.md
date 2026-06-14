# UI Guidelines

## Core Rule

When developing UI, do not add explanatory, instructional, promotional, placeholder, onboarding, or demo content of any kind.

Prefer the smallest functional surface:

- empty pages before placeholder pages
- command surfaces before explanatory panels
- icons before labels when the meaning is established
- real workflow controls before descriptive copy
- whitespace before filler content

## Empty Shell Rule

The initial application shell may include platform chrome, navigation containers, frames, and command surfaces.

Do not add:

- dashboard cards
- welcome text
- helper text
- sample data
- marketing copy
- tutorial blocks
- fake metrics
- decorative hero sections
- template explanations

Navigation destinations and pages stay empty until a real feature owns them.

## Review Gate

Before merging UI work, search changed XAML, C#, TSX, HTML, and Markdown-adjacent UI sources for explanatory strings. Remove any text that does not directly perform product work.
