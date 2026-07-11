'use client';

import { motion } from 'framer-motion';
import React from 'react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

export const typography = {
  sectionTitle: 'text-2xl md:text-[2.25rem] font-bold leading-tight',
  caption: 'text-sm md:text-base opacity-80',
};

type SectionProps = {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  variant?: 'default' | 'highlight' | 'subtle';
  className?: string;
  /** 'scroll' (default) reveals on scroll into view; 'mount' reveals immediately on mount (for use inside slides). */
  animateMode?: 'scroll' | 'mount';
};

export default function Section({
  title,
  subtitle,
  icon,
  children,
  variant = 'default',
  className = '',
  animateMode = 'scroll',
}: SectionProps) {
  const variants = {
    default: 'bg-slate-800/30 backdrop-blur-sm border border-slate-700/50',
    highlight: 'bg-gradient-to-r from-orange-500/10 to-pink-500/10 border border-orange-500/30',
    subtle: 'bg-slate-900/50',
  } as const;

  const revealProps =
    animateMode === 'mount'
      ? { initial: 'hidden', animate: 'visible' }
      : { initial: 'hidden', whileInView: 'visible', viewport: { once: true, amount: 0.2 } };

  return (
    <motion.section
      {...revealProps}
      variants={containerVariants}
      className={`${variants[variant]} rounded-2xl md:rounded-3xl p-4 sm:p-5 md:p-8 ${className}`}
    >
      {title && (
        <div className="flex items-start gap-3 md:gap-4 mb-4 md:mb-6">
          {icon && <div className="text-2xl md:text-3xl shrink-0">{icon}</div>}
          <div className="min-w-0">
            <h2 className={typography.sectionTitle}>{title}</h2>
            {subtitle && <p className={`${typography.caption} mt-1`}>{subtitle}</p>}
          </div>
        </div>
      )}
      {children}
    </motion.section>
  );
}


