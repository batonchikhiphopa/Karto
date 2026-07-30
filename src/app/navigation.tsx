import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";

const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", notify);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): string {
  return window.location.pathname;
}

export function usePathname(): string {
  return useSyncExternalStore(subscribe, snapshot, () => "/");
}

export function navigate(to: string, replace = false): void {
  if (window.location.pathname === to) return;
  window.history[replace ? "replaceState" : "pushState"]({}, "", to);
  window.scrollTo({ top: 0, behavior: "instant" });
  notify();
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
}

export function Link({ to, onClick, children, ...props }: LinkProps) {
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
      || props.target === "_blank"
    ) return;
    event.preventDefault();
    navigate(to);
  };
  return <a {...props} href={to} onClick={follow}>{children}</a>;
}

export function routeId(pathname: string, prefix: string): string {
  return decodeURIComponent(pathname.slice(prefix.length).split("/")[0] ?? "");
}

