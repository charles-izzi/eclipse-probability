import { lazy, Suspense } from "react";
import "./Shell.css";

const Calculator = lazy(() => import("./App"));
const StatsPage = lazy(() => import("./stats/StatsPage"));

export default function Shell() {
  const isStats = window.location.pathname.replace(/\/+$/, "") === "/stats";
  return (
    <>
      <title>{isStats ? "Game stats | Eclipse" : "Battle calculator | Eclipse"}</title>
      <a className="skip-link" href="#page-content">Skip to content</a>
      <header className="site-header">
        <a className="site-brand" href="/" aria-label="Eclipse home">
          <span className="eclipse-mark" aria-hidden="true" />
          ECLIPSE <span className="site-brand-subtitle">COMPANION</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="/" aria-current={!isStats ? "page" : undefined}>Battle calculator</a>
          <a href="/stats" aria-current={isStats ? "page" : undefined}>Game stats</a>
        </nav>
      </header>
      <main id="page-content" tabIndex={-1}>
        <Suspense fallback={<p className="page-loading" role="status">Loading page...</p>}>
          {isStats ? <StatsPage /> : <Calculator />}
        </Suspense>
      </main>
    </>
  );
}
