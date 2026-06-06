import { useEffect, useRef } from "react";
import { SAVE_DEBOUNCE_MS } from "@/lib/constants";

export function useDebounce(callback: () => void, delay: number = SAVE_DEBOUNCE_MS) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debounce = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(callback, delay);
  };

  return debounce;
}
