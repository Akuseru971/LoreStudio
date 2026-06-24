"use client";

type LockedPageUnlockCtaProps = {
  onUnlockClick?: () => void;
};

export default function LockedPageUnlockCta({ onUnlockClick }: LockedPageUnlockCtaProps) {
  if (!onUnlockClick) {
    return null;
  }

  return (
    <div className="locked-image-placeholder flex h-full min-h-56 w-full items-center justify-center p-6 text-center">
      <button type="button" onClick={onUnlockClick} className="unlock-full-book-button">
        Unlock full book
      </button>
    </div>
  );
}
