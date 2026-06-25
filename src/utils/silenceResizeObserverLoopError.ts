/**
 * The "ResizeObserver loop ..." notification is a benign signal defined by the
 * W3C Resize Observer spec: the browser delivered some observer callbacks and
 * deferred the rest to the next frame. It is NOT an application error — there
 * is no data loss and no infinite loop — but browsers dispatch it as a global
 * `error` event, which dev-server error overlays surface as a blocking error.
 *
 * Any library that observes its own container (here: React Flow) emits it
 * whenever that container's size changes every frame — e.g. dragging the
 * resizable inspector, the animated sidebar collapse, or `fitView` on load.
 *
 * We swallow ONLY messages in the "ResizeObserver loop" family so genuine
 * errors continue to surface untouched.
 *
 * Refs: https://github.com/WICG/resize-observer/issues/38
 */
const RESIZE_OBSERVER_LOOP_MESSAGE = "ResizeObserver loop";

export function silenceResizeObserverLoopError(): void {
  if (typeof window === "undefined") return;

  window.addEventListener(
    "error",
    (event) => {
      if (event.message?.includes(RESIZE_OBSERVER_LOOP_MESSAGE)) {
        // Stop dev overlays and other error listeners from treating it as a crash.
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true, // capture phase: run before the dev overlay's own error handler
  );
}
