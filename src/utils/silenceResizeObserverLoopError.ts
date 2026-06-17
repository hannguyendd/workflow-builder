/**
 * The "ResizeObserver loop completed with undelivered notifications" message is
 * a benign signal from the W3C Resize Observer spec: an observer callback
 * mutated layout, which queued another resize *inside the same delivery cycle*,
 * so the browser deferred the remaining notifications to the next frame. There
 * is no data loss and no real infinite loop — but the browser reports it as a
 * global `error` event, which dev-server overlays surface as a blocking error.
 *
 * Any library that observes its own container (here: React Flow) emits it when
 * that container resizes every frame — e.g. dragging the resizable inspector,
 * the animated sidebar collapse, or `fitView` on load.
 *
 * Root-cause fix: defer every ResizeObserver callback to the next animation
 * frame. The callback then runs *outside* the observation cycle, so the nested
 * resize loop never forms and the error is never dispatched in the first place.
 * This is more robust than swallowing the `error` event after the fact, which
 * races the dev overlay's own error handler for listener order.
 *
 * We also keep a narrow `error`-event guard as a backstop for any observer that
 * was constructed before this patch installed.
 *
 * Refs: https://github.com/WICG/resize-observer/issues/38
 */
const RESIZE_OBSERVER_LOOP_MESSAGE = "ResizeObserver loop";
const RAF_PATCH_FLAG = "__rafLoopFixApplied";

/**
 * Replace the global `ResizeObserver` with one that runs each callback in a
 * `requestAnimationFrame`, breaking the synchronous resize→layout→resize loop.
 */
function deferResizeObserverCallbacks(): void {
  if (typeof window === "undefined" || typeof window.ResizeObserver === "undefined") {
    return;
  }

  const NativeResizeObserver = window.ResizeObserver;

  // HMR re-runs this module; don't wrap an already-wrapped constructor.
  if ((NativeResizeObserver as unknown as Record<string, unknown>)[RAF_PATCH_FLAG]) {
    return;
  }

  class RafResizeObserver extends NativeResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      super((entries, observer) => {
        window.requestAnimationFrame(() => {
          callback(entries, observer);
        });
      });
    }
  }

  (RafResizeObserver as unknown as Record<string, unknown>)[RAF_PATCH_FLAG] = true;
  window.ResizeObserver = RafResizeObserver;
}

/** Backstop: drop only the benign loop message so genuine errors still surface. */
function suppressResizeObserverLoopEvent(): void {
  if (typeof window === "undefined") return;

  window.addEventListener(
    "error",
    (event) => {
      if (event.message?.includes(RESIZE_OBSERVER_LOOP_MESSAGE)) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true, // capture phase: run before the dev overlay's own error handler
  );
}

export function silenceResizeObserverLoopError(): void {
  deferResizeObserverCallbacks();
  suppressResizeObserverLoopEvent();
}
