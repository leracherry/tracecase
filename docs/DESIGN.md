# Interface design

TraceCase follows the project owner's teal-squircle and mint-dot identity. Shared tokens live in `packages/ui/tokens.css` and are imported by the viewer, extension review and popup. The page recording overlay uses the same ink/mint palette without importing styles into the recorded app.

| Role                         | Token                    | Color                 |
| ---------------------------- | ------------------------ | --------------------- |
| Brand ink / primary control  | `--brand-ink`            | `#0D252B`             |
| Mint / primary control label | `--brand-mint`           | `#49DCBC`             |
| Mint tint / selection        | `--selected`             | `#E6F7F2`             |
| Focus and positive status    | `--positive`             | `#176B56`             |
| Main text                    | `--text`                 | `#202123`             |
| Supporting text              | `--muted`                | `#5F6368`             |
| Canvas / surface             | `--canvas` / `--surface` | `#FAFAFA` / `#FFFFFF` |

The design adapts [OpenAI's public UI guidelines](https://developers.openai.com/apps-sdk/concepts/ui-guidelines): platform-native typography, restrained brand accents, consistent spacing, clear hierarchy, and accessible contrast. This standalone Chromium tool uses its own components and identity; it is not an OpenAI product or a ChatGPT-hosted app.

Use neutral reading surfaces, teal primary controls with mint labels, restrained mint selection/status accents, and semantic red/amber states with text labels. Body text stays readable rather than using bright mint on white. Controls use a visible focus ring and at least 44px height; selection is exposed with `aria-pressed`. File selectors remain keyboard-accessible. Inspectors and report tables wrap or scroll locally on narrow screens.

Keep layouts focused on the artifact: timeline, visual evidence, event detail, API replay coverage and privacy review. Use progressive disclosure for unavailable responses and environment details. Avoid decorative gradients, oversized metrics, custom font downloads and unrelated navigation. The logo uses the owner-requested transparent derivative described in the [brand guide](BRAND.md).

The export workbench continues the artifact workflow with expected-behavior tests, separately labelled reproduction checks, issue drafts and agent context. Previews reflect failure edits and privacy exclusions. Disabled exports explain missing assertions/private data, downloads confirm completion, and section links keep long recordings navigable.

Panels use a 16px corner radius, controls 10px and inset content 8px. Form borders use a stronger neutral than decorative separators. The layout caps at 1600px and adapts through tablet and mobile widths; mobile inputs use 16px text to avoid zoom on focus. Checkbox labels provide full touch targets. Focus rings, a skip link, keyboard-scrollable request tables and reduced-motion support apply throughout the inspector.

Empty recordings offer a file picker as well as drag-and-drop. Missing visual evidence explains the available alternatives. Opening a new recording clears timeline filters and privacy consent; clearing an empty search takes one action. Export notices reset when their inputs change. The popup prevents duplicate recording actions, reflects active capture settings and confirms bug markers.

## Developer reading surfaces

Code blocks share a selectable, keyboard-scrollable preview with Copy and Wrap controls. JSON, YAML, TypeScript, JavaScript, shell and Markdown use distinct syntax colors on a neutral surface. [Lowlight](https://github.com/wooorm/lowlight) supplies syntax trees; React renders only text and spans, never executable HTML from evidence. Previews are capped at 40,000 characters to keep large artifacts responsive; copying and downloading retain the full content. Export bundles expose a file selector for every companion file.

Native selects retain keyboard navigation and type-ahead. A shared CSS chevron sits 14px from the right edge with 44px reserved padding, including the demo and framework examples. Forced-color mode restores the browser's native arrow. Narrow screens keep 16px form text and 44px code-toolbar touch targets.
