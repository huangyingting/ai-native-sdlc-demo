import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource-variable/ibm-plex-sans";
import "./globals.css";
import { PlusIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

export const metadata: Metadata = {
  title: "Northstar IT Service Desk",
  description: "A compact enterprise IT service desk demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
    const param = new URLSearchParams(window.location.search).get("scoutTheme");
    const stored = window.localStorage.getItem("northstar-theme");
    const theme =
      param === "dark" || param === "light"
        ? param
        : stored === "dark" || stored === "light"
          ? stored
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    document.documentElement.setAttribute("data-theme", theme);
  })();`,
          }}
        />
      </head>
      <body>
        <header className="site-header">
          <div className="shell header-content">
            <Link className="brand" href="/">
              <span className="brand-mark" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <span>
                <strong>Northstar</strong>
                <small>Service operations</small>
              </span>
            </Link>
            <nav aria-label="Primary navigation">
              <Link className="nav-link" href="/">Tickets</Link>
              <ThemeToggle />
              <Link className="button button-primary button-small" href="/tickets/new">
                <PlusIcon />
                New ticket
              </Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="shell footer-content">
            <span>Northstar Service Operations</span>
            <span>Internal support workspace</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
