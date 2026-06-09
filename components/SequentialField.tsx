"use client";

import { motion } from "framer-motion";

type SequentialFieldProps = {
  children: React.ReactNode;
  isActive?: boolean;
};

export default function SequentialField({ children, isActive = false }: SequentialFieldProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: -10, filter: "blur(10px)" }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={`rounded-2xl border bg-black/25 p-4 transition ${
        isActive
          ? "border-[#7eb6ff]/45 shadow-[0_0_34px_rgba(71,132,211,0.16)]"
          : "border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      }`}
    >
      {children}
    </motion.div>
  );
}
