import React, { useState, useEffect, useRef } from 'react';

// Custom hook to get the previous value of a prop or state
function usePrevious<T>(value: T): T | undefined {
  // FIX: Provide an initial value to the useRef hook to satisfy TypeScript.
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

interface AnimatedNumberProps {
  value: number;
  duration?: number;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, duration = 500 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = usePrevious(value);
  // FIX: Provide an initial value to the useRef hook to satisfy TypeScript.
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Determine the starting point for the animation.
    // If there's no previous value (first render), start from 0.
    // Otherwise, start from the previous value to animate the change.
    const startValue = previousValue ?? 0;
    const endValue = value;

    // No animation needed if the value hasn't changed.
    if (endValue === startValue) {
        // This also ensures that on initial render if the component briefly shows 0,
        // it snaps to the correct value if no animation is needed.
        if (displayValue !== endValue) {
             setDisplayValue(endValue);
        }
        return;
    }

    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (!startTime) {
        startTime = timestamp;
      }
      const elapsedTime = timestamp - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      
      const currentValue = startValue + (endValue - startValue) * progress;
      setDisplayValue(Math.round(currentValue));

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    // Start the animation.
    frameRef.current = requestAnimationFrame(animate);

    // Cleanup function to cancel the animation frame if the component unmounts.
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, previousValue, duration, displayValue]);

  return <span>{displayValue}</span>;
};

export default AnimatedNumber;
