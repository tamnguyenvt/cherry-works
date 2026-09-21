import { render } from "preact";
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { RepoCharter } from "./RepoCharter.js";

/** The tabs of plan §4, in the order the mockup draws them. A view is mounted
 *  into the sheet under them, one task each. */
const TABS = [
  ["repo", "Repo Charter"],
  ["vendor", "Vendor"],
  ["test", "Test"],
] as const;

type Tab = (typeof TABS)[number][0];

/** What the modal is showing, or nothing: the explain, doctor, build and test
 *  views each open it with a title, a line of context and a body of their own. */
type Opened = { title: string; context?: string; body: ComponentChildren };

/** What was just done, as the toast says it. */
type Said = { did: string; detail?: string };

/** The page's shell: the header, the tabs, the sheet each view is rendered
 *  into, and the modal and the toast every view speaks through (plan §4).
 *
 *  It holds no charter and calls no route. What the modal and the toast show
 *  belongs to whoever opens them, so both are state here and neither is opened
 *  until a view arrives to open it. */
function Portal() {
  const [tab, setTab] = useState<Tab>("repo");
  const [buildMenu, setBuildMenu] = useState(false);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [said, setSaid] = useState<Said | null>(null);

  // The menu closes on the next click anywhere, as a menu does, including the
  // click that chose from it.
  useEffect(() => {
    if (!buildMenu) return;
    const close = () => setBuildMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [buildMenu]);

  return (
    <>
      <header class="top">
        <span class="brand">Cherry Works</span>
        {/* The repository this portal was started over. It is named once a
            route answers with it. */}
        <span class="repo" />
        <div class="search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" />
          </svg>
          <input type="search" placeholder="Search everything" spellcheck={false} autocomplete="off" />
        </div>
        <div class="split">
          <button class="btn">Build</button>
          <button
            class="btn caret"
            aria-label="More build options"
            onClick={(event) => {
              event.stopPropagation();
              setBuildMenu(!buildMenu);
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {buildMenu && (
            <div class="menu">
              <button>
                <b>Preview</b>
                <i>writes nothing — reports what the build would change</i>
              </button>
              <button>
                <b>Build</b>
                <i>regenerates the compiled output wholesale</i>
              </button>
            </div>
          )}
        </div>
        <button class="btn">Doctor</button>
      </header>

      <main class="shell">
        <div class="flowtabs">
          {TABS.map(([which, name]) => (
            <button key={which} class={which === tab ? "flowtab on" : "flowtab"} onClick={() => setTab(which)}>
              {name}
            </button>
          ))}
        </div>
        <div class="sheet" data-tab={tab}>
          {/* Mounted when its tab is shown and gone when another is, so each
              view reads the charter afresh and none of them holds it between
              showings (FR-007). */}
          {tab === "repo" && <RepoCharter />}
        </div>
      </main>

      {opened && <Modal opened={opened} onClose={() => setOpened(null)} />}
      {said && <Toast said={said} onDone={() => setSaid(null)} />}
    </>
  );
}

/** The one modal of plan §4, over whatever view is showing: a title, the
 *  identity or file it is about, and a body that scrolls. Closed by its ×, by
 *  the overlay behind it and by Escape — three ways out, since what it shows is
 *  read rather than filled in. */
function Modal({ opened, onClose }: { opened: Opened; onClose: () => void }) {
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onClose]);

  return (
    <div class="mdovl" onClick={onClose}>
      <div class="modal" onClick={(event) => event.stopPropagation()}>
        <div class="modal-h">
          <span class="t">{opened.title}</span>
          <span class="c">{opened.context}</span>
          <button class="x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <div class="modal-b">{opened.body}</div>
        <div class="modal-f" />
      </div>
    </div>
  );
}

/** What was just done, said for a moment and then gone. It reports; nothing is
 *  ever only in a toast, so it is never waited for and never dismissed by hand. */
function Toast({ said, onDone }: { said: Said; onDone: () => void }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Off the first paint, so the transition has an opacity to move from.
    const raised = requestAnimationFrame(() => setShown(true));
    const gone = setTimeout(onDone, 2600);
    return () => {
      cancelAnimationFrame(raised);
      clearTimeout(gone);
    };
  }, [said, onDone]);

  return (
    <div class={shown ? "toast on" : "toast"}>
      <b>{said.did}</b>
      {said.detail && <span>{said.detail}</span>}
    </div>
  );
}

render(<Portal />, document.body);
