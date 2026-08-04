import type { ReactNode } from "react";

export default function SlideShell({ number, eyebrow, title, description, children, compact = false }: { number: number; eyebrow: string; title: string; description: string; children: ReactNode; compact?: boolean }) {
  return (
    <section className={`slide-shell ${compact ? "slide-shell--compact" : ""}`} aria-labelledby={`slide-title-${number}`}>
      <header className="slide-heading">
        <div className="eyebrow"><span>{String(number).padStart(2, "0")}</span>{eyebrow}</div>
        <h1 id={`slide-title-${number}`}>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="slide-stage">{children}</div>
    </section>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status status--${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>;
}

export function HighlightBox({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={`highlight-box ${className}`}><span className="highlight-label">{label}</span>{children}</div>;
}

export function StepList({ items, start = 1 }: { items: string[]; start?: number }) {
  return <ol className="step-list">{items.map((item, index) => <li key={item}><span>{index + start}</span><p>{item}</p></li>)}</ol>;
}
