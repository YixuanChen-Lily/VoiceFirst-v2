import React from 'react';

interface SectionHeaderProps {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold leading-tight tracking-tight mb-1.5">{title}</h1>
      {description && <p className="text-lg text-ink-muted">{description}</p>}
    </div>
  );
}
