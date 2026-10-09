# UI and UX audit

[Documentation home](README.md) · [Design foundation](DESIGN.md)

This audit covers the local viewer, extension popup, recording bar, privacy settings, export/report tools, demo/framework examples, README and documentation. OpenAI’s published design system is the primary reference; WCAG supplies measurable accessibility criteria.

## Findings and changes

| Area                 | Finding                                                              | Improvement                                                                                   |
| -------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Typography           | 11–12px supporting text and code crowded the inspector               | 16px body, 14px supporting/control/code text, 12px captions; platform-native font stack       |
| Palette              | Custom neutral colors varied between surfaces and examples           | Shared official OpenAI foundation tokens; teal/mint reserved for branding and primary actions |
| Spacing              | Inconsistent gutters and nested preview frames                       | Aligned gutters, 4px spacing rhythm, one frame per tool, simpler counts                       |
| Width and height     | Wide prose and small detail pane; unnecessary empty-state height     | 1440px workspace, bounded prose, wider inspector, shorter useful empty states                 |
| Timeline             | Duplicate locator names and lowercase filter values                  | One human-readable target, explicit event categories, readable filter options                 |
| Controls             | Small code-toolbar/recording-bar targets and edge-clipped focus      | 44px actions, inset focus within scrolling regions, native select spacing                     |
| Validation           | Long generic errors and duplicate label/hint announcements           | Field-specific errors, `aria-invalid`, linked descriptions, focus recovery, preserved input   |
| Interaction contrast | Mint labels briefly faded across a light enabled/disabled transition | Immediate primary state changes; neutral supporting buttons                                   |
| Examples             | Demo colors and framework styling differed from the product          | Shared foundation stylesheet, responsive forms, visible status meaning                        |
| Documentation        | Wide navigation tables and stale product screenshots                 | Shorter summaries, consistent return links, labelled code samples and refreshed screenshots   |

The captured source application’s UI is evidence, not part of TraceCase’s product chrome. Automated product checks exclude the recorded-player subtree. Example applications owned by this repository are reviewed separately.

## Verification

The regression suite checks automated WCAG A/AA rules with axe on the loaded and empty viewer, popup, privacy settings and invalid-input state. It also checks page reflow at 320px, 768px and 1440px, text-spacing overrides, syntax contrast, keyboard use, privacy exclusions and exports. Existing capture/replay tests continue to exercise Chromium and Firefox capture and three-engine replay.

`npm run docs:screenshots` regenerates the five documented workflow screenshots from the actual extension and synthetic demo. Review those images along with desktop/mobile browser captures after visual changes. Documentation links and release-package smoke checks are separate validation steps.

These checks establish tested behavior for the included states. Automated accessibility checks and screenshots are not a full accessibility certification or independent usability study. Manual screen-reader sessions, production recordings and user feedback remain useful follow-up work.

## Keeping the design consistent

Use the shared tokens before introducing a new color, type size, radius or spacing value. Keep labels and accessible names aligned. Distinguish decorative separators from necessary control outlines. Test long URLs, empty data, failed validation and small screens before adding more controls.

Documentation should identify the user's next action early, keep tables compact, use language-labelled code fences and link to detailed references instead of repeating long explanations. GitHub-rendered documents retain GitHub's native layout; the product screenshots show the actual OpenAI-token interface.
