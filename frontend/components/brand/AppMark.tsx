import React from 'react';

interface AppMarkProps {
  /** Width and height of the tile, in pixels. */
  size?: number;
  className?: string;
}

/** The app's icon: a pen inside a speech bubble. You talk, it helps you write. */
export function AppMark({ size = 44, className = '' }: AppMarkProps) {
  return (
    <div
      className={`flex items-center justify-center bg-forest shrink-0 ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.27 }}
    >
      <svg
        aria-hidden="true"
        width={size / 2}
        height={size / 2}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3.5 20.5l1.4-4.6A8.5 8.5 0 1 1 21 11.5z" />
        <path d="M8.5 14.5l1-3 4.5-4.5 2 2-4.5 4.5z" />
      </svg>
    </div>
  );
}
