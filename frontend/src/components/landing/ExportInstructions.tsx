'use client';
import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const T = {
  darkblue: "#2776F5",
  paper: "#F1ECDE",
  card: "#FBF8EF",
  ink: "#100F0C",
  lime: "#AEE63E",
  amber: "#F2B33D",
  cyan: "#53CFE6",
  purple: "#A98BEA",
  red: "#E8463A",
  muted: "#6F6E63",
  darkamber: "#e16517",
  lines: "#cdcdcd"
};
const MONO = 'ui-monospace, "Cascadia Code", "Courier New", monospace';
const SERIF = 'Georgia, "Times New Roman", serif';
const shadow = (n: number) => `${n}px ${n}px 0 ${T.ink}`;

export default function ExportInstructions() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section style={{ margin: '0 auto', width: '100%', maxWidth: 720, textAlign: 'left' }}>
      <div style={{ border: `2.5px solid ${T.ink}`, background: T.card, padding: '16px', boxShadow: shadow(2) }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: SERIF,
            fontSize: 18,
            fontWeight: 700,
            color: T.ink,
            transition: 'all 90ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1';
          }}
        >
          <span>How to Export Your Letterboxd Data</span>
          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }}>
            <ChevronDown className="w-5 h-5" style={{ color: T.ink }} />
          </motion.div>
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ marginTop: 16, fontFamily: MONO, fontSize: 12, color: T.ink, lineHeight: 1.6 }}>
                <ol style={{ listStyle: 'decimal inside', margin: 0, paddingLeft: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <li>Go to your <strong style={{ color: T.lime }}>Profile</strong> &rarr; <strong style={{ color: T.lime }}>Settings</strong></li>
                  <li>Open the <strong style={{ color: T.lime }}>Data</strong> tab</li>
                  <li>Click <strong style={{ color: T.lime }}>Export Your Data</strong></li>
                  <li>A <strong style={{ color: T.lime }}>.zip file</strong> will download</li>
                  <li>Upload it here</li>
                </ol>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
