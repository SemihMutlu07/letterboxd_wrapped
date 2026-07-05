'use client';

import { motion } from 'framer-motion';
import React from 'react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

export const typography = {
  sectionTitle: 'text-xl md:text-[1.9rem] font-black leading-tight tracking-normal text-[#fff7ed]',
  caption: 'text-sm md:text-base text-[#b6a99a]',
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
    default: 'relative overflow-hidden border border-[#f5d7a8]/[0.12] bg-[#17120f]/85 shadow-2xl shadow-black/20 backdrop-blur-sm before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(90deg,rgba(245,215,168,0.05)_1px,transparent_1px),linear-gradient(rgba(245,215,168,0.035)_1px,transparent_1px)] before:bg-[size:42px_42px]',
    highlight: 'relative overflow-hidden border border-[#ff8a3d]/30 bg-[linear-gradient(135deg,rgba(255,138,61,0.14),rgba(68,152,164,0.09))] shadow-2xl shadow-black/20',
    subtle: 'relative overflow-hidden border border-[#f5d7a8]/[0.09] bg-[#120f0d]/80',
  } as const;

  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={containerVariants}
      className={`${variants[variant]} rounded-[20px] md:rounded-[28px] p-4 sm:p-5 md:p-8 ${className}`}
    >
      <div className="relative z-10">
        {title && (
          <div className="mb-4 flex items-start gap-3 border-b border-[#f5d7a8]/[0.08] pb-4 md:mb-6 md:gap-4">
          {icon && <div className="text-2xl md:text-3xl shrink-0">{icon}</div>}
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.28em] text-[#d8b56d]">
              Dossier note
            </p>
            <h2 className={typography.sectionTitle}>{title}</h2>
            {subtitle && <p className={`${typography.caption} mt-1`}>{subtitle}</p>}
          </div>
        </div>
        )}
        {children}
      </div>
    </motion.section>
  );
}

