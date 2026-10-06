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

Use neutral reading surfaces, teal primary controls with mint labels, restrained mint selection/status accents, and semantic red/amber states with text labels. Body text stays readable rather than using bright mint on white. Controls use a visible focus ring and at least 40px height; selection is exposed with `aria-pressed`. File selectors remain keyboard-accessible. Inspectors and report tables wrap or scroll locally on narrow screens.

Keep layouts focused on the artifact: timeline, visual evidence, event detail, API replay coverage and privacy review. Use progressive disclosure for unavailable responses and environment details. Avoid decorative gradients, oversized metrics, custom font downloads and unrelated navigation. The supplied logo remains unchanged.
