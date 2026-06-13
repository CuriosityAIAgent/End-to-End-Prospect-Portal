import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 4500), // begin exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="w-[1px] h-[10vh] bg-[var(--bank-gold)] mb-8"
        initial={{ height: 0, opacity: 0 }}
        animate={phase >= 1 ? { height: '10vh', opacity: 1 } : { height: 0, opacity: 0 }}
        transition={{ duration: 1, ease: 'easeInOut' }}
      />

      <div className="overflow-hidden mb-4">
        <motion.h1 
          className="text-[6vw] font-display leading-none text-center"
          initial={{ y: '100%' }}
          animate={phase >= 2 ? { y: 0 } : { y: '100%' }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          Source of <span className="text-gradient-gold italic">Wealth</span>
        </motion.h1>
      </div>

      <motion.p 
        className="text-[1.5vw] font-light text-[var(--color-text-secondary)] tracking-widest uppercase mt-4"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 1, ease: 'easeOut' }}
      >
        The interactive private-banking workspace
      </motion.p>
    </motion.div>
  );
}
