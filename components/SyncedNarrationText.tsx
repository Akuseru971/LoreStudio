"use client";

import { motion } from "framer-motion";

type SyncedNarrationTextProps = {
  text: string;
  isActive?: boolean;
};

export default function SyncedNarrationText({ text, isActive = true }: SyncedNarrationTextProps) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: isActive ? 1 : 0.94 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="book-body-text mt-5"
    >
      {text}
    </motion.p>
  );
}
