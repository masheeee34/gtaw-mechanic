import type { ReactNode } from 'react';

interface SectionProps {
  title: string;
  children: ReactNode;
}

export function Section({ title, children }: SectionProps) {
  return (
    <section className="section" aria-label={title}>
      <header className="section-header">{title}</header>
      {children}
    </section>
  );
}

interface RowProps {
  label: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}

export function Row({ label, description, children }: RowProps) {
  return (
    <div className="row">
      <div className="row-text">
        <div className="row-label">{label}</div>
        {description && <div className="row-description">{description}</div>}
      </div>
      {children && <div className="row-control">{children}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
