'use client';
import { useId } from 'react';
import { cn } from '@/lib/utils';

export type MiloPose =
  'welcome' | 'loading' | 'error' | 'celebrate' | 'message';

const INK = 'var(--color-milo-ink)';
const SPARK = 'var(--color-milo-spark)';

/**
 * Milo, the QuizMB mascot, as an animated SVG. Animations live in
 * styles/milo.css and run only when the viewer allows motion. Decorative by
 * default; pass `label` when Milo is the only content that says something.
 */
export function Milo({
  pose,
  label,
  className,
}: {
  pose: MiloPose;
  label?: string;
  className?: string;
}) {
  // Gradient ids must be unique per instance on the page.
  const id = useId().replace(/:/g, '');
  const body = `url(#${id}-body)`;
  const limb = `url(#${id}-limb)`;
  const bobble = `url(#${id}-bobble)`;
  const eyes = (left: [number, number], right: [number, number]) => (
    <g className="milo-blink">
      {[left, right].map(([x, y]) => (
        <g key={x}>
          <ellipse cx={x} cy={y} rx="7.5" ry="10" fill={INK} />
          <circle cx={x + 2.5} cy={y - 4.5} r="2.4" fill="#fff" />
        </g>
      ))}
    </g>
  );
  const stroke = {
    stroke: INK,
    strokeWidth: 3.2,
    strokeLinecap: 'round' as const,
    fill: 'none',
  };
  const egg = (
    <path
      d="M110 58C148 58 170 104 172 138C174 174 148 196 110 196C72 196 46 174 48 138C50 104 72 58 110 58Z"
      fill={body}
    />
  );
  const head = <ellipse cx="128" cy="62" rx="21" ry="18" fill={bobble} />;
  const feet = (
    <>
      <ellipse cx="90" cy="199" rx="17" ry="10" fill={limb} />
      <ellipse cx="130" cy="199" rx="17" ry="10" fill={limb} />
    </>
  );
  const ground = (className?: string) => (
    <ellipse
      className={className}
      cx="110"
      cy="214"
      rx="52"
      ry="6"
      fill="var(--color-milo-limb)"
      opacity="0.14"
    />
  );

  return (
    <svg
      viewBox="0 0 220 230"
      className={cn('milo h-auto overflow-visible', className)}
      {...(label
        ? { role: 'img', 'aria-label': label }
        : { 'aria-hidden': true })}
      focusable="false"
    >
      <defs>
        <radialGradient id={`${id}-body`} cx="38%" cy="28%" r="80%">
          <stop offset="0" style={{ stopColor: '#fff' }} />
          <stop offset="0.5" style={{ stopColor: 'var(--color-milo-body)' }} />
          <stop
            offset="1"
            style={{ stopColor: 'var(--color-milo-body-shade)' }}
          />
        </radialGradient>
        <radialGradient id={`${id}-limb`} cx="35%" cy="30%" r="80%">
          <stop
            offset="0"
            style={{ stopColor: 'var(--color-milo-limb-light)' }}
          />
          <stop offset="1" style={{ stopColor: 'var(--color-milo-limb)' }} />
        </radialGradient>
        <radialGradient id={`${id}-bobble`} cx="35%" cy="30%" r="80%">
          <stop offset="0" style={{ stopColor: 'var(--color-milo-bobble)' }} />
          <stop
            offset="1"
            style={{ stopColor: 'var(--color-milo-bobble-shade)' }}
          />
        </radialGradient>
      </defs>

      {pose === 'welcome' && (
        <>
          {ground()}
          <g className="milo-bob">
            {feet}
            <ellipse
              cx="170"
              cy="152"
              rx="12"
              ry="22"
              transform="rotate(-18 170 152)"
              fill={limb}
            />
            {egg}
            {head}
            <g className="milo-wave">
              <ellipse
                cx="52"
                cy="114"
                rx="12.5"
                ry="25"
                transform="rotate(-22 52 114)"
                fill={limb}
              />
              <circle cx="64" cy="97" r="7" fill={limb} />
            </g>
            <g className="milo-spark" stroke={SPARK} strokeWidth="5">
              <path
                d="M26 92l-12-5M32 77l-8-10M46 68l-3-12"
                strokeLinecap="round"
              />
            </g>
            {eyes([92, 116], [130, 116])}
            <path d="M80 99q8-7 17-2M121 94q8-5 16 1" {...stroke} />
            <path d="M100 137q10 9 20 0" {...stroke} />
          </g>
        </>
      )}

      {pose === 'message' && (
        <>
          {ground()}
          <g className="milo-bob">
            {feet}
            {egg}
            {head}
            {eyes([92, 116], [130, 116])}
            <path d="M80 99q8-7 17-2M121 94q8-5 16 1" {...stroke} />
            <path d="M100 137q10 9 20 0" {...stroke} />
            <g transform="rotate(-8 110 170)">
              <rect
                x="66"
                y="150"
                width="88"
                height="48"
                rx="8"
                fill="var(--color-surface)"
                stroke="var(--color-milo-limb)"
                strokeWidth="3"
              />
              <path
                d="m68 154 42 28 42-28M68 194l25-20M152 194l-25-20"
                fill="none"
                stroke="var(--color-milo-limb)"
                strokeWidth="3"
                strokeLinejoin="round"
              />
            </g>
            <ellipse cx="65" cy="171" rx="13" ry="11" fill={limb} />
            <ellipse cx="155" cy="159" rx="13" ry="11" fill={limb} />
            <g
              className="milo-spark"
              stroke={SPARK}
              strokeWidth="4"
              strokeLinecap="round"
            >
              <path d="m182 138 12-7m-14-5 6-12m-3 38 13 2" />
            </g>
          </g>
        </>
      )}

      {pose === 'loading' && (
        <>
          {ground()}
          <g fill="var(--color-milo-bobble)">
            <circle className="milo-dot" cx="172" cy="62" r="6" />
            <circle className="milo-dot" cx="188" cy="42" r="7.5" />
            <circle className="milo-dot" cx="204" cy="18" r="9" />
          </g>
          <g className="milo-sway">
            {feet}
            <ellipse
              cx="50"
              cy="158"
              rx="12"
              ry="22"
              transform="rotate(20 50 158)"
              fill={limb}
            />
            {egg}
            {head}
            {eyes([95, 113], [132, 111])}
            <path d="M83 96q8-7 16-2M122 90q8-5 15 2" {...stroke} />
            <circle cx="116" cy="138" r="4" fill={INK} />
            <ellipse cx="142" cy="146" rx="14" ry="12" fill={limb} />
          </g>
        </>
      )}

      {pose === 'error' && (
        <>
          {ground()}
          <g
            className="milo-spark"
            stroke={SPARK}
            strokeWidth="5"
            strokeLinecap="round"
          >
            <path d="M14 112l-11-5M20 98l-7-10M206 112l11-5M200 98l7-10" />
          </g>
          <g className="milo-shrug">
            {feet}
            <g className="milo-shake-left">
              <ellipse
                cx="38"
                cy="134"
                rx="23"
                ry="11"
                transform="rotate(-14 38 134)"
                fill={limb}
              />
            </g>
            <g className="milo-shake-right">
              <ellipse
                cx="182"
                cy="134"
                rx="23"
                ry="11"
                transform="rotate(14 182 134)"
                fill={limb}
              />
            </g>
            {egg}
            {head}
            {eyes([92, 118], [130, 118])}
            <path d="M80 102q9 3 16-5M123 97q8 8 16 5" {...stroke} />
            <path d="M101 143q9-8 18 0" {...stroke} />
          </g>
        </>
      )}

      {pose === 'celebrate' && (
        <>
          {ground('milo-ground')}
          <g className="milo-confetti">
            <rect
              x="36"
              y="14"
              width="6"
              height="13"
              rx="1.5"
              fill="var(--color-milo-limb)"
            />
            <circle cx="70" cy="8" r="4" fill="var(--color-milo-bobble)" />
            <rect
              x="168"
              y="8"
              width="6"
              height="13"
              rx="1.5"
              fill="var(--color-milo-limb)"
            />
            <circle cx="192" cy="34" r="4" fill="var(--color-milo-bobble)" />
            <rect
              x="126"
              y="2"
              width="5"
              height="11"
              rx="1.5"
              fill="var(--color-milo-limb-light)"
            />
            <rect
              x="92"
              y="4"
              width="6"
              height="10"
              rx="1.5"
              fill="var(--color-milo-bobble)"
            />
          </g>
          <g className="milo-jump">
            <ellipse cx="92" cy="199" rx="17" ry="10" fill={limb} />
            <ellipse
              cx="136"
              cy="186"
              rx="16"
              ry="9"
              transform="rotate(-28 136 186)"
              fill={limb}
            />
            <g className="milo-cheer-left">
              <ellipse
                cx="50"
                cy="100"
                rx="12"
                ry="25"
                transform="rotate(-22 50 100)"
                fill={limb}
              />
            </g>
            <g className="milo-cheer-right">
              <ellipse
                cx="170"
                cy="100"
                rx="12"
                ry="25"
                transform="rotate(22 170 100)"
                fill={limb}
              />
            </g>
            {egg}
            {head}
            <path
              d="M84 118q8-11 16 0M122 118q8-11 16 0"
              {...stroke}
              strokeWidth={3.6}
            />
            <path d="M97 134q13 19 26 0Z" fill={INK} />
          </g>
        </>
      )}
    </svg>
  );
}
