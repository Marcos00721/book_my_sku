import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, LogOut, Search, X } from "lucide-react";
import { BrandMark } from "../auth/BrandMark";
import { Button } from "./Button";
import { Tooltip } from "./Tooltip";
import "../../styles/sidebar.css";

function SidebarNavigation({ groups, label, query, onNavigate }) {
  const indicatorId = useId();
  const filtered = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${item.label} ${group.label}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    }))
    .filter((group) => group.items.length);

  return (
    <motion.nav className="glass-sidebar-nav" aria-label={label} layoutScroll>
      {filtered.map((group) => (
        <div className="glass-sidebar-group" key={group.label}>
          <p className="glass-sidebar-group-label">{group.label}</p>
          {group.items.map(({ to, label: itemLabel, Icon, active }) => (
            <>
              <Link
                className="glass-sidebar-link"
                key={to}
                to={to}
                aria-label={itemLabel}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                {active && (
                  <motion.span
                    className="glass-sidebar-indicator"
                    layoutId={indicatorId}
                    initial={false}
                    transition={{ type: "spring", stiffness: 420, damping: 38 }}
                    aria-hidden="true"
                  />
                )}
                <Icon size={20} aria-hidden="true" />
                <span className="glass-sidebar-label">{itemLabel}</span>
              </Link>
            </>
          ))}
        </div>
      ))}
      {!filtered.length && (
        <p className="glass-sidebar-empty" role="status">
          No pages found.
        </p>
      )}
    </motion.nav>
  );
}

/** Shared sidebar chrome; callers retain routing, permissions and account actions. */
export function GlassSidebar({
  variant = "workspace",
  groups,
  scope,
  brandTo,
  email,
  role,
  signOut,
  signingOut = false,
  drawerRef,
  menuButtonRef,
  mainRef,
  children,
}) {
  const storageKey = `bookmysku.sidebar.${variant}.collapsed`;
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  });
  const [query, setQuery] = useState("");
  const desktopSearch = useRef(null);
  const mobileSearch = useRef(null);
  const navigationLabel =
    variant === "admin" ? "Platform administration" : "Workspace navigation";
  const drawerLabel =
    variant === "admin" ? "Admin navigation" : "Workspace navigation";

  function toggleCollapsed() {
    setQuery("");
    const nextValue = !collapsed;
    try {
      localStorage.setItem(storageKey, String(nextValue));
    } catch {
      /* Optional preference. */
    }
    setCollapsed(nextValue);
  }

  function closeDrawer() {
    drawerRef.current?.close();
    menuButtonRef.current?.focus();
  }

  function navigatePage() {
    setQuery("");
    if (drawerRef.current?.open) {
      drawerRef.current.close();
      mainRef.current?.focus();
    }
  }

  function containKeyboardFocus(event) {
    if (event.key !== "Tab") return;
    const controls = [
      ...event.currentTarget.querySelectorAll(
        'a[href], button:not(:disabled), input:not(:disabled), [tabindex="0"]',
      ),
    ].filter((element) => element.getClientRects().length);
    const first = controls[0];
    const last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  useEffect(() => {
    function focusSearch(event) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k")
        return;
      // Leave shortcuts inside other modal workflows alone.
      if (document.querySelector("dialog[open]") && !drawerRef.current?.open)
        return;
      event.preventDefault();
      if (window.matchMedia("(max-width: 800px)").matches) {
        if (!drawerRef.current.open) drawerRef.current.showModal();
        mobileSearch.current?.focus();
      } else {
        setCollapsed(false);
        desktopSearch.current?.focus();
      }
    }
    function closeOnDesktop(event) {
      if (!event.matches && drawerRef.current?.open) drawerRef.current.close();
    }
    const media = window.matchMedia("(max-width: 800px)");
    window.addEventListener("keydown", focusSearch);
    media.addEventListener("change", closeOnDesktop);
    return () => {
      window.removeEventListener("keydown", focusSearch);
      media.removeEventListener("change", closeOnDesktop);
    };
  }, [drawerRef]);

  function contents(mobile) {
    const ScopeIcon = scope.Icon;
    return (
      <>
        <div className="glass-sidebar-header">
          <div className="glass-sidebar-brand" onClick={navigatePage}>
            <span className="glass-sidebar-full-brand">
              <BrandMark to={brandTo} />
            </span>
            <Link
              className="glass-sidebar-compact-brand"
              to={brandTo}
              aria-label="BookMySku home"
            >
              <img
                src="/logos/bookmysku-icon.svg"
                width="32"
                height="32"
                alt=""
              />
            </Link>
          </div>
          <Button
            variant="icon"
            className="glass-sidebar-toggle"
            aria-label={
              mobile
                ? "Close navigation"
                : collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
            }
            aria-expanded={mobile ? undefined : !collapsed}
            title={
              mobile
                ? "Close navigation"
                : collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
            }
            onClick={mobile ? closeDrawer : toggleCollapsed}
          >
            {mobile ? (
              <X size={18} />
            ) : collapsed ? (
              <ChevronRight size={18} />
            ) : (
              <ChevronLeft size={18} />
            )}
          </Button>
        </div>
        <Tooltip content={scope.label}>
          <div className="glass-sidebar-scope">
            <span className="glass-sidebar-scope-icon">
              <ScopeIcon size={18} aria-hidden="true" />
            </span>
            <div className="glass-sidebar-label">
              <strong>{scope.label}</strong>
              <small>{scope.subtitle}</small>
            </div>
          </div>
        </Tooltip>
        <div className="glass-sidebar-search">
          <Search size={18} aria-hidden="true" />
          <input
            ref={mobile ? mobileSearch : desktopSearch}
            type="search"
            aria-label="Find a page"
            placeholder="Find a page…"
            value={query}
            onFocus={() => {
              if (!mobile) setCollapsed(false);
            }}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                event.stopPropagation();
                setQuery("");
              }
            }}
          />
          <kbd aria-hidden="true">Ctrl K</kbd>
        </div>
        {children && <div className="glass-sidebar-extra">{children}</div>}
        <SidebarNavigation
          groups={groups}
          label={navigationLabel}
          query={query}
          onNavigate={navigatePage}
        />
        <div className="glass-sidebar-account">
          <span className="avatar-letter" aria-hidden="true">
            {email.slice(0, 1).toUpperCase() || "A"}
          </span>
          <div className="glass-sidebar-label">
            <strong>{role}</strong>
            <Tooltip content={email}>
              <small>{email || "Signed-in account"}</small>
            </Tooltip>
          </div>
          <Button
            variant="icon"
            aria-label="Sign out"
            title="Sign out"
            disabled={signingOut}
            onClick={signOut}
          >
            <LogOut size={17} />
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <aside
        className={`glass-sidebar ${variant === "admin" ? "admin-sidebar" : "sidebar"} ${collapsed ? "is-collapsed" : ""}`}
        aria-label={variant === "admin" ? "Admin sidebar" : "Workspace sidebar"}
      >
        {contents(false)}
      </aside>
      <dialog
        ref={drawerRef}
        className="glass-sidebar-drawer"
        aria-label={drawerLabel}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
        onClose={() => setQuery("")}
        onKeyDown={containKeyboardFocus}
      >
        <div className="glass-sidebar-mobile-content">{contents(true)}</div>
      </dialog>
    </>
  );
}
