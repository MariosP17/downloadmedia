import { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

export function AnimatedNumber({ value }: { value: number }) {
  const count = useMotionValue(0);
  // useTransform rounds the animated decimal to an integer
  const rounded = useTransform(count, (latest) => Math.round(latest));

  useEffect(() => {
    // Animates from 0 (or previous value) to the target value
    const controls = animate(count, value, { duration: 0.7, ease: "easeOut" });
    return () => controls.stop();
  }, [value, count]);

  return <motion.span>{rounded}</motion.span>;
}