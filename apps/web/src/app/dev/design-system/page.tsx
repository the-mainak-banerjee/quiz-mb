import { notFound } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Badge,
  Button,
  FormField,
  Input,
  Surface,
  Text,
} from '@/components/ui';

const colors = [
  ['Canvas', 'bg-canvas'],
  ['Surface', 'bg-surface'],
  ['Muted surface', 'bg-surface-muted'],
  ['Primary action', 'bg-action-primary'],
  ['Secondary action', 'bg-action-secondary'],
  ['Accent / focus', 'bg-accent'],
  ['Primary text', 'bg-text-primary'],
  ['Secondary text', 'bg-text-secondary'],
  ['Surface border', 'bg-border-surface'],
  ['Control border', 'bg-border-control'],
  ['Live surface', 'bg-status-live-surface'],
  ['Scheduled surface', 'bg-status-scheduled-surface'],
  ['Neutral status', 'bg-status-neutral-surface'],
  ['Error', 'bg-danger'],
] as const;

export default function DesignSystemPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return (
    <div className="space-y-space-2xl">
      <section className="space-y-space-sm">
        <Text as="h1" variant="display">
          QuizMB design system
        </Text>
        <Text tone="secondary">
          Internal development reference. Use Tab to inspect focus, and pointer
          hover/press to inspect button states. No form submits or product
          actions are connected.
        </Text>
      </section>
      <Surface
        as="section"
        aria-labelledby="type-title"
        className="space-y-space-md"
      >
        <Text as="h2" variant="section-heading" id="type-title">
          Typography
        </Text>
        <Text variant="display">Display — clear-headed focus</Text>
        <Text variant="page-title">Page title — deliberate hierarchy</Text>
        <Text variant="section-heading">Section heading</Text>
        <Text variant="card-title">Card title</Text>
        <Text>Body — a generous rhythm for sustained reading.</Text>
        <Text variant="body-secondary" tone="secondary">
          Secondary body — supporting descriptions.
        </Text>
        <Text variant="label">Label — quiet emphasis</Text>
        <Text variant="caption" tone="secondary">
          Caption — supporting metadata
        </Text>
      </Surface>
      <Surface
        as="section"
        aria-labelledby="buttons-title"
        className="space-y-space-md"
      >
        <Text as="h2" variant="section-heading" id="buttons-title">
          Buttons
        </Text>
        <div className="flex flex-wrap items-center gap-space-sm">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button size="hero">Hero trigger</Button>
        </div>
        <div className="flex flex-wrap gap-space-sm">
          <Button disabled>Primary disabled</Button>
          <Button variant="secondary" disabled>
            Secondary disabled
          </Button>
          <Button variant="outline" disabled>
            Outline disabled
          </Button>
          <Button variant="ghost" disabled>
            Ghost disabled
          </Button>
        </div>
      </Surface>
      <Surface
        as="section"
        aria-labelledby="inputs-title"
        className="space-y-space-md"
      >
        <Text as="h2" variant="section-heading" id="inputs-title">
          Inputs and fields
        </Text>
        <div className="grid gap-space-md md:grid-cols-2">
          <div className="space-y-space-xs">
            <label htmlFor="standalone" className="block text-label">
              Standalone input
            </label>
            <Input id="standalone" placeholder="Enter text" />
          </div>
          <FormField
            label="With a hint"
            hint="Supporting instructions remain associated with the input."
            placeholder="Enter text"
          />
          <FormField
            label="Validation example"
            defaultValue="Example value"
            error="An example error message."
          />
          <FormField
            label="Disabled field"
            disabled
            defaultValue="Unavailable"
          />
        </div>
      </Surface>
      <section aria-labelledby="surfaces-title" className="space-y-space-md">
        <Text as="h2" variant="section-heading" id="surfaces-title">
          Surface and badges
        </Text>
        <Surface className="space-y-space-md">
          <Text as="h3" variant="card-title">
            A calm foreground surface
          </Text>
          <Text variant="body-secondary" tone="secondary">
            Card padding, stone border, rounded corners, and ambient depth. No
            product-specific layout is encoded.
          </Text>
          <div className="flex flex-wrap gap-space-sm">
            <Badge variant="live" />
            <Badge variant="scheduled" />
            <Badge variant="draft" />
            <Badge variant="completed" />
          </div>
        </Surface>
      </section>
      <section aria-labelledby="palette-title" className="space-y-space-md">
        <Text as="h2" variant="section-heading" id="palette-title">
          Semantic palette
        </Text>
        <div className="grid grid-cols-2 gap-gutter-sm md:grid-cols-4 md:gap-gutter lg:gap-gutter-lg">
          {colors.map(([label, color]) => (
            <div key={label} className="space-y-space-xs">
              <div
                aria-hidden="true"
                className={cn(
                  'h-control-large rounded-control border-(length:--stroke-width) border-border-surface',
                  color,
                )}
              />
              <Text variant="caption">{label}</Text>
              <Text variant="caption" tone="secondary">
                {color}
              </Text>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
