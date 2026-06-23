"use client";

type LockedPagePaywallCtaProps = {
  onUnlock: () => void;
};

export default function LockedPagePaywallCta({ onUnlock }: LockedPagePaywallCtaProps) {
  return (
    <div className="locked-page-cta-overlay">
      <div className="locked-page-cta-dim" aria-hidden="true" />
      <div className="locked-page-cta-card">
        <span className="locked-page-kicker">Your story continues beyond this page</span>
        <button type="button" onClick={onUnlock} className="locked-page-cta-button">
          Unlock the full book
        </button>
        <p className="locked-page-helper">Continue the complete illustrated chronicle</p>
      </div>
    </div>
  );
}
