# Interface design

[Documentation home](README.md) · [Audit and validation](UI_UX_AUDIT.md)

OpenAI’s public Apps SDK UI design system is the primary reference for TraceCase’s interface. The viewer, extension, privacy settings and examples share its neutral palette, platform-native fonts, typography scale, 4px spacing foundation and published radius tokens. TraceCase’s teal/mint identity is reserved for the logo and primary actions.

## Foundation and provenance

`packages/ui/openai-foundations.css` derives from **@openai/apps-sdk-ui 0.2.2**. It contains the published primitive, semantic and component CSS variables. The Tailwind-only `@theme static` wrapper is converted to `:root`, and wildcard reset declarations are removed for native CSS. The MIT notice is retained in `packages/ui/OPENAI_LICENSE` and included in release notices. The application uses native semantic HTML and React; it does not ship unused SDK components or custom font downloads.

The product aliases in `packages/ui/tokens.css` map to these upstream variables:

| Product role                     | OpenAI foundation                                                       |
| -------------------------------- | ----------------------------------------------------------------------- |
| Reading surface / canvas         | `--color-surface` / `--gray-50`                                         |
| Main / supporting text           | `--color-text` / `--color-text-secondary`                               |
| Selection / neutral hover        | `--color-background-primary-soft`                                       |
| Decorative separator             | `--color-border`                                                        |
| Input/control outline            | `--gray-400`                                                            |
| Success / error / warning text   | `--color-text-success` / `--color-text-danger` / `--color-text-warning` |
| Body / supporting / caption text | 16px / 14px / 12px                                                      |
| Panel / control / inset radius   | `--radius-2xl` / `--control-radius-lg` / `--radius-md`                  |
| Touch control height             | 44px (`--control-size-2xl`)                                             |

Native controls use a stronger outline than decorative separators so they remain identifiable. Teal `#0D252B` and mint `#49DCBC` appear together on primary actions with readable contrast; mint is not used as body text on a white surface. Selection remains neutral. Syntax colors belong to recorded/generated content rather than structural UI.

## Layout and reading

The workspace caps at 1440px, with aligned 24px desktop gutters and consistent panel padding. Prose is constrained to approximately 68 characters per line. The timeline, visual evidence and inspector form one workspace; secondary review and export sections follow the same spacing rhythm. Tablet and mobile layouts change at 1024px and 768px. Visual replay fits the pane by default; **Actual size** preserves the recorded scale in a keyboard-scrollable viewport for reading details. Mobile controls keep 16px input text; tables and code scroll within their own regions.

Use one border around a tool, then separators for its internal regions. Avoid redundant nested cards, decorative gradients, oversized metric tiles and unnecessary badges. The export preview owns one border. Counts are lightweight text. Event labels show a single readable target; complete locators remain available in the inspector.

## Interaction and states

Controls have visible keyboard focus and 44px action targets. Checkbox captions enlarge their targets. Timeline selection is exposed with `aria-pressed`; empty states offer a useful next action. File pickers stay keyboard-accessible. Status and errors include words rather than relying on color alone. The popup hides configuration help while recording, keeping current settings and recording actions visible without repeating inactive-control instructions. Its height is bounded to 600px with native scrolling for longer text and platform-font differences.

Privacy validation identifies the affected list, associates its explanation with the input, preserves entered values and focuses the first invalid field. Hints are separate from labels so assistive technology does not announce them twice. Primary buttons change disabled/enabled state without fading mint text across a light surface. Reduced-motion preferences disable other transitions.

Code previews provide syntax colors, Copy, Wrap and companion-file selection. They render only text and spans from locally bundled Lowlight grammars. Previews are limited to 40,000 characters; copying and downloading retain the complete content. Native selects keep keyboard/type-ahead behavior, with the chevron inset 14px and 44px of reserved right padding. Forced colors restore the native arrow.

The recording bar uses matching neutral surfaces, control dimensions and restrained elevation. Its styles stay local to the bar so the recorded application retains its own appearance.

## References and scope

- [OpenAI UI guidelines](https://developers.openai.com/plugins/concepts/ui-guidelines)
- [Official Apps SDK UI source](https://github.com/openai/apps-sdk-ui)
- [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [control contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) and [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)

TraceCase is a standalone developer tool. ChatGPT-specific widget containers and host-app branding rules do not describe its browser-extension or local-viewer packaging. GitHub controls README and documentation typography; those files use restrained native Markdown, concise tables, labelled code fences and actual product screenshots.
