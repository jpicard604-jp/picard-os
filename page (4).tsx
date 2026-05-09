@import "tailwindcss";

@theme inline {
  --font-display: var(--font-sora);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}

:root {
  /* Deep space palette — near-black with a subtle cool cast */
  --background: #07070a;
  --surface: #0d0e12;
  --surface-raised: #13141a;
  --surface-overlay: #1a1b22;

  /* Borders */
  --border: rgba(255, 255, 255, 0.055);
  --border-strong: rgba(255, 255, 255, 0.10);
  --border-focus: rgba(59, 130, 246, 0.35);

  /* Typography */
  --foreground: #eceef5;
  --muted: #5e6278;
  --subtle: #3a3c4e;

  /* Layout */
  --sidebar-width: 240px;
}

html, body {
  height: 100%;
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overscroll-behavior: none;
}

/* Film grain — creates depth and premium texture */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 9998;
  pointer-events: none;
  opacity: 0.028;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-size: 200px 200px;
}

/* ─── Scrollbar ─────────────────────────────────────────────────────────────── */
.no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
.no-scrollbar::-webkit-scrollbar { display: none; }

/* ─── Safe area + scroll ─────────────────────────────────────────────────────── */
.content-area {
  padding-bottom: calc(3.75rem + env(safe-area-inset-bottom));
}
.nav-safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
@media (min-width: 1024px) {
  .content-area {
    padding-bottom: 2.5rem;
  }
}

/* ─── Card system ────────────────────────────────────────────────────────────── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 1rem;
}

.card-elevated {
  box-shadow:
    0 1px 0 0 rgba(255, 255, 255, 0.04) inset,
    0 0 0 1px rgba(255, 255, 255, 0.02) inset;
}

.card-hover {
  transition: border-color 200ms ease, background 200ms ease;
}
.card-hover:hover {
  border-color: var(--border-strong);
  background: var(--surface-raised);
}

/* ─── Glow system ────────────────────────────────────────────────────────────── */
.glow-blue {
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.12), 0 4px 32px rgba(59, 130, 246, 0.08), 0 1px 0 0 rgba(255,255,255,0.03) inset;
}
.glow-green {
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.10), 0 4px 24px rgba(34, 197, 94, 0.05);
}
.glow-amber {
  box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.10), 0 4px 24px rgba(245, 158, 11, 0.05);
}

/* ─── Ambient hero gradient (reusable) ──────────────────────────────────────── */
.hero-ambient {
  background: radial-gradient(
    ellipse at 20% 0%,
    rgba(59, 130, 246, 0.055) 0%,
    transparent 60%
  );
}

/* ─── Form inputs ────────────────────────────────────────────────────────────── */
.field {
  background: var(--surface-raised);
  border: 1px solid var(--border-strong);
  border-radius: 0.75rem;
  padding: 0.75rem 1rem;
  color: var(--foreground);
  font-size: 0.9375rem;
  transition: border-color 180ms ease;
  width: 100%;
  outline: none;
}
.field::placeholder { color: var(--muted); }
.field:focus { border-color: var(--border-focus); }

/* ─── Animations ─────────────────────────────────────────────────────────────── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-in {
  animation: fadeUp 0.28s ease-out both;
}

@keyframes ping-slow {
  0%   { transform: scale(1); opacity: 0.7; }
  100% { transform: scale(1.9); opacity: 0; }
}
.animate-ping-slow {
  animation: ping-slow 1.5s ease-out infinite;
}

@keyframes shimmer {
  from { background-position: -200% center; }
  to   { background-position: 200% center; }
}
.shimmer {
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%);
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
}

/* ─── Typography helpers ─────────────────────────────────────────────────────── */
.label {
  font-size: 0.6rem;
  font-family: var(--font-geist-mono), monospace;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}

.section-title {
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--muted);
  font-family: var(--font-geist-sans), system-ui, sans-serif;
}

/* ─── Page header pattern ────────────────────────────────────────────────────── */
.page-header {
  padding: 2.5rem 1.5rem 1.5rem;
  border-bottom: 1px solid var(--border);
}
@media (min-width: 1024px) {
  .page-header {
    padding: 3rem 2.5rem 2rem;
  }
}
