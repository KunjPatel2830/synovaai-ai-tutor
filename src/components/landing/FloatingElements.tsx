import { motion } from "framer-motion";

export function FloatingElements() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Floating math/science symbols */}
      {["∑", "π", "∞", "Δ", "∫", "√", "α", "β"].map((symbol, i) => (
        <motion.span
          key={i}
          className="absolute text-primary/[0.06] font-mono select-none"
          style={{
            fontSize: `${20 + Math.random() * 30}px`,
            left: `${5 + (i * 12)}%`,
            top: `${10 + Math.random() * 80}%`,
          }}
          animate={{
            y: [0, -20, 0],
            rotate: [0, 10, -10, 0],
            opacity: [0.04, 0.08, 0.04],
          }}
          transition={{
            duration: 4 + Math.random() * 4,
            repeat: Infinity,
            delay: i * 0.5,
            ease: "easeInOut",
          }}
        >
          {symbol}
        </motion.span>
      ))}
    </div>
  );
}
