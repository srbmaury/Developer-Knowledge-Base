import { useEffect, useRef } from "react";

/**
 * Hook to debounce a callback function with a specified delay.
 * The callback is called only after the specified delay has passed since the last call.
 */
export function useDebounce(callback: () => void, delay: number = 500) {
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
