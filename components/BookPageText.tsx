"use client";

import { motion } from "framer-motion";

type BookPageTextProps = {
  text: string;
  isActive: boolean;
};

export default function BookPageText({ text, isActive }: BookPageTextProps) {
  return (
    <motion.p
      initial={{ opacity: 0 }}
      animate={{ opacity: isActive ? 1 : 0.88 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
      className="font-book-body mt-4"
    >
      {text}
    </motion.p>
  );
}
