// The browser side of the live refresh (0042, 0044): keep one server-rendered
// container current. On a wanted "post N changed", and whenever the event
// stream reconnects, refetch the container's own HTML over a logged-in request
// and swap it in — keeping scroll, focus and any half-made radio choice, and
// saying nothing when nothing changed. The filter is src/lib/live.ts.

interface Options {
  container: HTMLElement;
  /** The route that returns the container's inner HTML. */
  url: string;
  /** Whether a `data:` payload from /api/events calls for a refetch. */
  wants: (data: string) => boolean;
  /** Told to a screen reader, politely, after a swap that changed something. */
  announce?: { region: HTMLElement | null; text: string };
}

// A stable name for a control across a swap: where it goes (or which form it
// belongs to), what it is and what it says.
function controlKey(el: Element): string {
  const form = el instanceof HTMLElement && "form" in el ? (el as HTMLInputElement).form : null;
  const where = el.getAttribute("href") ?? form?.getAttribute("action") ?? "";
  const named = el.getAttribute("name") ?? "";
  return [el.tagName, where, named, el.getAttribute("value") ?? "", el.textContent?.trim() ?? ""].join("|");
}

function swapIn(container: HTMLElement, html: string): boolean {
  const next = document.createElement("template");
  next.innerHTML = html;
  const current = document.createElement("template");
  current.innerHTML = container.innerHTML;
  if (next.innerHTML === current.innerHTML) return false;

  const { scrollX, scrollY } = window;
  const focused = document.activeElement;
  const focusKey = focused && container.contains(focused) ? controlKey(focused) : null;
  const checked = new Map<string, string>();
  for (const radio of container.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked')) {
    checked.set(radio.name, radio.value);
  }

  container.innerHTML = html;

  for (const radio of container.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
    if (checked.get(radio.name) === radio.value) radio.checked = true;
  }
  if (focusKey !== null) {
    const same = [...container.querySelectorAll<HTMLElement>("a, button, input, select, textarea")].find(
      (el) => controlKey(el) === focusKey,
    );
    same?.focus({ preventScroll: true });
  }
  window.scrollTo(scrollX, scrollY);
  return true;
}

export function startLive({ container, url, wants, announce }: Options): void {
  let inFlight = false;
  let again = false;

  async function refetch(): Promise<void> {
    // a burst of events (an accept touches several posts) is one refetch after
    // the one in flight, not one each
    if (inFlight) {
      again = true;
      return;
    }
    inFlight = true;
    try {
      const res = await fetch(url, { credentials: "same-origin", headers: { accept: "text/html" } });
      // a logged-out or missing answer is never swapped in
      if (!res.ok || res.redirected) return;
      if (swapIn(container, await res.text()) && announce?.region) {
        // clear first so the same words are announced again next time
        announce.region.textContent = "";
        setTimeout(() => {
          if (announce.region) announce.region.textContent = announce.text;
        }, 50);
      }
    } catch {
      // offline: the stream's reconnect refetches
    } finally {
      inFlight = false;
      if (again) {
        again = false;
        void refetch();
      }
    }
  }

  const source = new EventSource("/api/events");
  let opened = false;
  source.addEventListener("open", () => {
    // the first open is the page's own load; every later one is a reconnect,
    // and events may have been missed while the stream was down
    if (opened) void refetch();
    opened = true;
  });
  source.addEventListener("message", (event) => {
    if (wants(event.data)) void refetch();
  });
}
