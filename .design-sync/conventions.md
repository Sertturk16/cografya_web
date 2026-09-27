## Coğrafya Gurmesi (Terra) — how to build with this library

A Turkish geography learning site: atlas pages, province and country detail pages, map tools,
quizzes and book video solutions. Earth/topographic look: terracotta primary, olive secondary,
water-teal accent on a warm parchment page. Fraunces for headings, Nunito Sans for everything else.

### Setup

- No provider or wrapper is needed; import from `window.CografyaGurmesi` and render.
  `styles.css` carries every token (light in `:root`, dark in `.dark`), the fonts and all styles.
- Dark mode ("Night Sea", deep petrol): put `className="dark"` on the root element of the design.
- Put page content on `bg-background`; panels on `bg-card`.

### Styling: Tailwind utilities on Terra tokens — never raw colours

Only utilities the site already uses are compiled, so stay inside these families; for anything
else use an inline `style` with `var(--token)` (e.g. `style={{ color: "var(--primary)" }}`).

- Surfaces: `bg-background`, `bg-card`, `bg-muted`, `bg-primary`, `bg-secondary`, `bg-accent`,
  `bg-destructive`; tints like `bg-primary/10`, `bg-success/10`, `bg-warning/10`.
- Text: `text-foreground` (body), `text-muted-foreground` (secondary text), `text-primary`,
  `text-primary-strong` (headings/labels on light surfaces), `text-primary-foreground` (on
  `bg-primary`), `text-secondary`, `text-accent`, `text-success`, `text-destructive`, and the
  `-strong` members (`text-success-strong`, `text-warning-strong`, `text-info-strong`) for text
  on a tint of that colour.
- Lines and shape: `border-border`, `border-primary`; radius `rounded-lg` (controls),
  `rounded-2xl` (tiles), `rounded-3xl` (section panels).
- Type: `font-heading` (Fraunces) for headings and big figures only; body is Nunito Sans by
  default. Numbers in tables and strips take `tabular-nums`.
- Page width: wrap page bodies in `PageContainer` (max-w-7xl with the site gutters).

### Components to reach for

- Headings: `H1` (hub pages, terracotta), `H1Display` (a single place: "Ankara"), `H2`, `H3`,
  `H4`, `Lede`, `Muted`, `Kbd`. One `H1` per page.
- Page top: `Card variant="feature"` holding `PageHero tier="hub" | "detail"` with `Badge`s.
- Sections: `Card variant="panel"`; hero strips over a tinted band: `Card variant="glass"`.
- Figures: `StatGrid` of `StatTile`s — a measurement takes `value` + `unit` + `absent`
  (never print 0 or "—" for missing data), a literal takes `fact`; colour via `tone`.
- Forms: `FormField` (label + control + helper/error together), `FormErrorSummary`, `Input`,
  `Select`, `CustomSelect` (searchable, for long lists like 81 provinces), `Label`.
- Feedback: `Alert` for system events only (not for teaching asides), `Spinner`, `Skeleton`,
  `Progress`, `Tooltip`. Overlays: `Dialog`, `Sheet`. Navigation: `Tabs`, `Breadcrumb`.
- Data: `Table` family, numeric columns right-aligned; `MetricValue` for a single reading.

### Rules the site holds

- Brand colours are chrome, never data: do not encode values on maps or charts with Terra
  tokens.
- Copy is Turkish, addressing the reader as "sen"; buttons and headings in Title Case
  (`guidelines/docs/copy.md`).
- Controls a reader taps are at least 44px tall on touch layouts.

### Example

```jsx
const { PageContainer, Card, PageHero, Badge, StatGrid, StatTile, Button } = window.CografyaGurmesi;

<PageContainer>
  <Card variant="feature">
    <PageHero
      tier="detail"
      heading="Rize"
      badges={<Badge variant="chip">Karadeniz Bölgesi</Badge>}
      lede="Türkiye'nin en çok yağış alan ili; çay tarımının merkezi."
    />
  </Card>
  <StatGrid>
    <StatTile
      label="Nüfus"
      value={348608}
      locale="tr"
      absent={{ label: "Veri yok" }}
      tone="primary"
    />
    <StatTile
      label="Yıllık Yağış"
      value={2300}
      unit="mm"
      locale="tr"
      absent={{ label: "Veri yok" }}
      tone="accent"
    />
  </StatGrid>
  <Button variant="primary">Haritada Gör</Button>
</PageContainer>;
```
