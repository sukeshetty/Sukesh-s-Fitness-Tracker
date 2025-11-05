import React, { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
  className?: string;
  showChangeIndicator?: boolean; // Show +/- indicator
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ 
  value, 
  duration = 800, 
  decimals = 0,
  suffix = '',
  className = '',
  showChangeIndicator = false,
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [changeDirection, setChangeDirection] = useState<'up' | 'down' | null>(null);
  // FIX: Provide an initial value to useRef to resolve "Expected 1 arguments, but got 0" error.
  const frameRef = useRef<number | undefined>(undefined);
  // FIX: Provide an initial value to useRef to resolve "Expected 1 arguments, but got 0" error.
  const startTimeRef = useRef<number | undefined>(undefined);
  const startValueRef = useRef<number>(0);
  const previousValueRef = useRef<number>(0);

  useEffect(() => {
    // Set initial value without animation
    if (previousValueRef.current === 0 && displayValue === 0) {
        setDisplayValue(value);
        previousValueRef.current = value;
        return;
    }

    if (displayValue === value) return;

    // Determine direction
    if (value > previousValueRef.current) {
      setChangeDirection('up');
    } else if (value < previousValueRef.current) {
      setChangeDirection('down');
    }

    setIsAnimating(true);
    startValueRef.current = displayValue;
    startTimeRef.current = undefined;

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = startValueRef.current + (value - startValueRef.current) * easeOut;
      setDisplayValue(currentValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
        previousValueRef.current = value;
        setIsAnimating(false);
        
        // Clear change indicator after animation
        setTimeout(() => setChangeDirection(null), 500);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, duration, displayValue]);

  const formattedValue = displayValue.toFixed(decimals);

  const getColorClass = () => {
    if (!isAnimating) return '';
    if (changeDirection === 'up') return 'text-green-400 scale-110';
    if (changeDirection === 'down') return 'text-red-400 scale-90';
    return 'text-blue-400';
  };

  return (
    <span className={`inline-flex items-center gap-1 transition-all duration-300 ${className} ${getColorClass()}`}>
      {showChangeIndicator && changeDirection && (
        <span className={`text-sm ${changeDirection === 'up' ? 'text-green-400' : 'text-red-400'}`}>
          {changeDirection === 'up' ? '↑' : '↓'}
        </span>
      )}
      <span>{formattedValue}{suffix}</span>
    </span>
  );
};

export default AnimatedNumber;
