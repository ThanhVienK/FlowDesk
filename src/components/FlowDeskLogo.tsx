interface Props {
  size?: number;
  className?: string;
}

/**
 * FlowDesk custom logo mark.
 *
 * Concept: a USDC coin (circle) with two parallel flow lines passing through
 * it — representing treasury "flow" being routed through a controlled approval
 * gate.  The two rounded strokes recall both a payment flow and the dollar‑sign
 * double bar, anchoring it to finance without being literal.
 *
 * Built entirely from SVG paths — no icon library dependency, no generic icon.
 */
export function FlowDeskMark({ size = 28, className = '' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Outer coin ring */}
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2.2" />

      {/* Top flow line — enters left, exits right, slightly curved upward */}
      <path
        d="M4 13 C8 13 10 11 16 11 C22 11 24 13 28 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Bottom flow line — enters left, exits right, slightly curved downward */}
      <path
        d="M4 19 C8 19 10 21 16 21 C22 21 24 19 28 19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Center approval node — small filled dot */}
      <circle cx="16" cy="16" r="2.8" fill="currentColor" />
    </svg>
  );
}

/**
 * Full wordmark: mark + logotype.
 * Use in Sidebar header and LandingPage nav.
 */
export function FlowDeskWordmark({ markSize = 28 }: { markSize?: number }) {
  return (
    <div className="flex items-center gap-2.5 select-none" aria-label="FlowDesk">
      <div
        className="flex items-center justify-center flex-shrink-0 rounded-lg"
        style={{
          width: markSize,
          height: markSize,
          color: 'var(--accent)',
        }}
      >
        <FlowDeskMark size={markSize - 2} />
      </div>
      <span
        className="display font-semibold text-base"
        style={{ color: 'var(--ink)', letterSpacing: '-0.025em' }}
      >
        Flow<span style={{ color: 'var(--accent)' }}>Desk</span>
      </span>
    </div>
  );
}
