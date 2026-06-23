export function blurActiveElement() {
  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }
}

export function resetMobileBookScroll(scrollContainer: HTMLElement | null) {
  blurActiveElement();

  if (scrollContainer) {
    scrollContainer.scrollTop = 0;
    scrollContainer.scrollLeft = 0;
  }

  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  let parent = scrollContainer?.parentElement ?? null;
  while (parent) {
    if (parent.scrollHeight > parent.clientHeight) {
      parent.scrollTop = 0;
    }
    parent = parent.parentElement;
  }
}

export function scheduleMobileBookScrollReset(scrollContainer: HTMLElement | null) {
  resetMobileBookScroll(scrollContainer);

  requestAnimationFrame(() => {
    resetMobileBookScroll(scrollContainer);
    requestAnimationFrame(() => {
      resetMobileBookScroll(scrollContainer);
    });
  });
}
