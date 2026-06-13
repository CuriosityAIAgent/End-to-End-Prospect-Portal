import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
      setTimeout(() => setPhase(4), 2800),
      setTimeout(() => setPhase(5), 3600),
      setTimeout(() => setPhase(6), 6500), // begin exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const steps = ["Identify", "Cold Call", "Brief", "Meet", "Onboard"];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col justify-center pl-[15vw] z-10"
      initial={{ opacity: 0, x: -100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.h2 
        className="text-[4vw] font-display leading-tight mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 1 }}
      >
        One <span className="text-gradient-gold">Continuous</span> Rail.
      </motion.h2>

      <div className="flex flex-col gap-6 relative">
        <motion.div 
          className="absolute left-[8px] top-4 bottom-4 w-[1px] bg-[var(--color-bg-muted)]"
          initial={{ height: 0 }}
          animate={phase >= 2 ? { height: '100%' } : { height: 0 }}
          transition={{ duration: 2, ease: "linear" }}
        />

        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-8 relative z-10">
            <motion.div 
              className="w-4 h-4 rounded-full border border-[var(--bank-gold)] bg-[var(--color-bg-dark)]"
              initial={{ scale: 0, backgroundColor: 'var(--color-bg-dark)' }}
              animate={phase >= i + 1 ? { scale: 1, backgroundColor: 'var(--bank-gold)' } : { scale: 0, backgroundColor: 'var(--color-bg-dark)' }}
              transition={{ duration: 0.5, type: 'spring' }}
            />
            <motion.span 
              className="text-[2vw] font-light text-[var(--color-text-primary)]"
              initial={{ opacity: 0, x: -20 }}
              animate={phase >= i + 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              {step}
            </motion.span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
