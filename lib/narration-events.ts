export const NARRATION_START_EVENT = "lore-studio:narration-start";
export const NARRATION_END_EVENT = "lore-studio:narration-end";

export function dispatchNarrationStart() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(NARRATION_START_EVENT));
}

export function dispatchNarrationEnd() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(NARRATION_END_EVENT));
}
