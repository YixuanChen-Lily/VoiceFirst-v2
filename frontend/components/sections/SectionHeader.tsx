import React from 'react';
import { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  number: number;
  title: string;
  icon: LucideIcon;
  description?: string;
}

export function SectionHeader({ number, title, icon: Icon, description }: SectionHeaderProps) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className="flex-shrink-0 w-12 h-12 bg-emerald-700 text-white rounded-full flex items-center justify-center">
        {number === 0 ? '📄' : number}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-1">
          <Icon className="w-6 h-6 text-emerald-700" />
          <h2 className="text-emerald-900">{title}</h2>
        </div>
        {description && (
          <p className="text-stone-600 text-sm mt-1">{description}</p>
        )}
      </div>
    </div>
  );
}