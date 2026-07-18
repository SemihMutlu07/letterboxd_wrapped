import React from 'react';

export const typography = {
  sectionTitle: 'text-2xl md:text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--results-text)]',
  caption: 'text-sm md:text-base text-[var(--results-muted)]',
};

type SectionProps = {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  variant?: 'default' | 'highlight' | 'subtle';
  className?: string;
};

export default function Section({
  title,
  subtitle,
  icon,
  children,
  variant = 'default',
  className = '',
}: SectionProps) {
  const variants = {
    default: 'results-scene',
    highlight: 'results-scene results-scene-highlight',
    subtle: 'results-scene results-scene-subtle',
  } as const;

  return (
    <section
      className={`${variants[variant]} px-0 py-8 md:py-12 ${className}`}
    >
      <div className="relative z-10">
        {title && (
          <div className="mb-6 flex items-start gap-3 md:mb-8 md:gap-4">
          {icon && <div className="text-2xl md:text-3xl shrink-0">{icon}</div>}
          <div className="min-w-0">
            <h2 className={typography.sectionTitle}>{title}</h2>
            {subtitle && <p className={`${typography.caption} mt-1`}>{subtitle}</p>}
          </div>
        </div>
        )}
        {children}
      </div>
    </section>
  );
}
