import { cn } from '@/lib/utils';

export type EmptyStateIllustrationKind =
  'project' | 'quiz' | 'question' | 'registration' | 'participant' | 'history';

// Colours come from theme tokens via fill-*/stroke-* utilities, so the
// illustrations follow the design system (and any future theme change).
const card = 'fill-surface stroke-border-surface';
const well = 'fill-surface-low stroke-border-surface';
const bar = 'fill-surface-high';
const strong = 'fill-action-primary';
const dashed = 'fill-none stroke-border-control [stroke-dasharray:4_3]';
const ring = 'fill-none stroke-action-primary';

function Plus({ x, y, r = 10 }: { x: number; y: number; r?: number }) {
  const arm = r * 0.45;
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={r}
        className="fill-surface-low stroke-border-control"
        strokeWidth="1.5"
      />
      <path
        d={`M${x - arm} ${y}H${x + arm}M${x} ${y - arm}V${y + arm}`}
        className="stroke-surface-dim"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </g>
  );
}

function Tick({ x, y, r = 10 }: { x: number; y: number; r?: number }) {
  const arm = r * 0.45;
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={r}
        className="fill-surface-low stroke-border-control"
        strokeWidth="1.5"
      />
      <path
        d={`M${x - arm} ${y + arm * 0.05}l${arm * 0.8} ${arm * 0.8}l${arm * 1.2} -${arm * 1.6}`}
        className="fill-none stroke-surface-dim"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** A list row: leading marker plus a text bar. */
function Row({
  x,
  y,
  width,
  marker = 'dot',
}: {
  x: number;
  y: number;
  width: number;
  marker?: 'dot' | 'radio';
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height="14"
        rx="5"
        className={well}
        strokeWidth="1"
      />
      {marker === 'dot' ? (
        <circle cx={x + 8} cy={y + 7} r="2" className="fill-accent" />
      ) : (
        <circle
          cx={x + 9}
          cy={y + 7}
          r="4"
          className={ring}
          strokeWidth="1.25"
        />
      )}
      <rect
        x={x + 18}
        y={y + 5}
        width={width * 0.5}
        height="4"
        rx="2"
        className={bar}
      />
    </g>
  );
}

function Illustration({ kind }: { kind: EmptyStateIllustrationKind }) {
  switch (kind) {
    case 'project':
      return (
        <>
          <rect
            x="14"
            y="22"
            width="172"
            height="116"
            rx="12"
            className={dashed}
            strokeWidth="1.25"
          />
          <rect x="28" y="34" width="44" height="5" rx="2.5" className={bar} />
          <rect
            x="78"
            y="34"
            width="22"
            height="5"
            rx="2.5"
            className="fill-surface-dim"
          />
          <rect
            x="28"
            y="52"
            width="86"
            height="50"
            rx="7"
            className={card}
            strokeWidth="1"
          />
          <rect x="36" y="60" width="40" height="5" rx="2.5" className={bar} />
          <rect x="36" y="72" width="62" height="4" rx="2" className={bar} />
          <rect x="36" y="82" width="50" height="4" rx="2" className={bar} />
          <rect
            x="56"
            y="76"
            width="118"
            height="58"
            rx="8"
            className={card}
            strokeWidth="1.25"
          />
          <rect x="66" y="84" width="36" height="6" rx="3" className={strong} />
          <rect
            x="108"
            y="84"
            width="22"
            height="6"
            rx="3"
            className="fill-action-secondary"
          />
          <Row x={66} y={98} width={98} />
          <Row x={66} y={116} width={98} />
          <Plus x={170} y={36} r={13} />
        </>
      );
    case 'quiz':
      return (
        <>
          <rect
            x="40"
            y="12"
            width="120"
            height="136"
            rx="12"
            className={card}
            strokeWidth="1.25"
          />
          <rect x="54" y="26" width="58" height="8" rx="4" className={strong} />
          <rect
            x="118"
            y="26"
            width="28"
            height="8"
            rx="4"
            className="fill-action-secondary"
          />
          <Row x={54} y={46} width={92} marker="radio" />
          <Row x={54} y={68} width={92} marker="radio" />
          <rect
            x="54"
            y="94"
            width="92"
            height="40"
            rx="8"
            className={dashed}
            strokeWidth="1.5"
          />
          <Plus x={100} y={114} r={10} />
        </>
      );
    case 'history':
      return (
        <>
          <rect
            x="40"
            y="12"
            width="120"
            height="136"
            rx="12"
            className={card}
            strokeWidth="1.25"
          />
          <rect x="54" y="26" width="58" height="8" rx="4" className={strong} />
          <rect
            x="118"
            y="26"
            width="28"
            height="8"
            rx="4"
            className="fill-action-secondary"
          />
          <Row x={54} y={46} width={92} />
          <Row x={54} y={68} width={92} />
          <rect
            x="54"
            y="94"
            width="92"
            height="40"
            rx="8"
            className={dashed}
            strokeWidth="1.5"
          />
          <Tick x={100} y={114} r={10} />
        </>
      );
    case 'question':
      return (
        <>
          <rect
            x="26"
            y="22"
            width="148"
            height="116"
            rx="12"
            className={card}
            strokeWidth="1.25"
          />
          <rect x="38" y="34" width="26" height="5" rx="2.5" className={bar} />
          <rect
            x="68"
            y="34"
            width="38"
            height="5"
            rx="2.5"
            className="fill-accent-soft"
          />
          <circle cx="160" cy="36" r="3" className="fill-accent" />
          <rect
            x="38"
            y="48"
            width="124"
            height="6"
            rx="3"
            className={strong}
          />
          <rect x="38" y="60" width="72" height="4" rx="2" className={bar} />
          <path
            d="M38 74H162"
            className="stroke-border-surface"
            strokeWidth="1"
          />
          <Row x={38} y={82} width={124} marker="radio" />
          <Row x={38} y={102} width={124} marker="radio" />
          <rect
            x="38"
            y="122"
            width="124"
            height="14"
            rx="5"
            className={dashed}
            strokeWidth="1.25"
          />
          <circle
            cx="47"
            cy="129"
            r="4"
            className={dashed}
            strokeWidth="1.25"
          />
          <path
            d="M153 125.5l3.5 3.5-3.5 3.5-3.5-3.5z"
            className="fill-accent"
          />
        </>
      );
    case 'registration':
      return (
        <>
          <rect
            x="26"
            y="20"
            width="148"
            height="120"
            rx="12"
            className={card}
            strokeWidth="1.25"
          />
          <rect
            x="38"
            y="32"
            width="56"
            height="7"
            rx="3.5"
            className={strong}
          />
          <rect
            x="130"
            y="32"
            width="32"
            height="7"
            rx="3.5"
            className="fill-action-secondary"
          />
          <rect x="38" y="46" width="34" height="4" rx="2" className={bar} />
          <path
            d="M38 58H162"
            className="stroke-border-surface"
            strokeWidth="1"
          />
          <rect
            x="38"
            y="66"
            width="124"
            height="6"
            rx="3"
            className="fill-surface-low"
          />
          <rect
            x="38"
            y="66"
            width="12"
            height="6"
            rx="3"
            className="fill-surface-dim"
          />
          {[54, 80, 106].map((cx) => (
            <g key={cx}>
              <circle
                cx={cx}
                cy="92"
                r="10"
                className={dashed}
                strokeWidth="1.25"
              />
              <circle cx={cx} cy="89.5" r="3" className="fill-surface-dim" />
              <path
                d={`M${cx - 6} 98c1-3 3-4.5 6-4.5s5 1.5 6 4.5`}
                className="fill-surface-dim"
              />
            </g>
          ))}
          <Plus x={136} y={92} r={11} />
          <rect
            x="38"
            y="112"
            width="124"
            height="16"
            rx="6"
            className={well}
            strokeWidth="1"
          />
          <circle cx="47" cy="120" r="2.5" className="fill-accent" />
          <rect x="55" y="118" width="48" height="4" rx="2" className={bar} />
        </>
      );
    case 'participant':
      return (
        <>
          <rect
            x="22"
            y="22"
            width="156"
            height="116"
            rx="12"
            className={card}
            strokeWidth="1.25"
          />
          <circle cx="36" cy="35" r="2.5" className="fill-accent" />
          <rect
            x="43"
            y="33"
            width="34"
            height="4"
            rx="2"
            className="fill-action-secondary"
          />
          <rect x="132" y="33" width="34" height="4" rx="2" className={bar} />
          <path
            d="M34 46H166"
            className="stroke-border-surface"
            strokeWidth="1"
          />
          {[34, 78, 122].map((x) => (
            <g key={x}>
              <rect
                x={x}
                y="54"
                width="44"
                height="40"
                rx="7"
                className={dashed}
                strokeWidth="1.25"
              />
              <circle
                cx={x + 22}
                cy="70"
                r="8"
                className="fill-action-secondary stroke-accent-soft [stroke-dasharray:2_2]"
                strokeWidth="1.25"
              />
              <rect
                x={x + 10}
                y="84"
                width="24"
                height="3"
                rx="1.5"
                className="fill-surface-dim"
              />
            </g>
          ))}
          <rect
            x="34"
            y="102"
            width="132"
            height="26"
            rx="7"
            className={well}
            strokeWidth="1"
          />
          <circle cx="50" cy="115" r="4" className={ring} strokeWidth="1.25" />
          <rect x="58" y="113" width="22" height="4" rx="2" className={bar} />
          <circle cx="98" cy="115" r="4.5" className={ring} strokeWidth="1.5" />
          <circle cx="98" cy="115" r="1.8" className={strong} />
          <rect
            x="107"
            y="113"
            width="34"
            height="4"
            rx="2"
            className={strong}
          />
        </>
      );
  }
}

/**
 * Structural empty-state illustration for a missing list: projects, quizzes,
 * questions, registrations, participants or completed-quiz history. Decorative: the surrounding
 * heading and copy already describe the state, so it is hidden from
 * assistive technology. Fixed 5:4 box, so nothing shifts when it renders.
 */
export function EmptyStateIllustration({
  kind,
  className,
}: {
  kind: EmptyStateIllustrationKind;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 160"
      width="200"
      height="160"
      aria-hidden="true"
      focusable="false"
      className={cn('h-auto w-40 max-w-full shrink-0', className)}
    >
      <Illustration kind={kind} />
    </svg>
  );
}
