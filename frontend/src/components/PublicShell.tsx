import { SitePage } from "./SiteChrome";

/**
 * Chrome for pages anyone may open without signing in, such as the Integrity
 * Passport. The shared site header and footer, so the public side reads as one
 * system with the same language, text-size and theme controls everywhere.
 */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return <SitePage>{children}</SitePage>;
}
