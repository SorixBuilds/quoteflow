# Shared components

Cross-feature, app-specific composite components (e.g. `PageHeader`,
`EmptyState`, `DataTable`). They are built **on top of** the unstyled
primitives in `../ui` and may encode QuoteFlow layout conventions.

Keep anything tied to a single feature in that feature's folder instead
(`src/features/<feature>/components`).
