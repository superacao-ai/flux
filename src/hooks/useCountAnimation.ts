import { useEffect, useState } from 'react';

export function useCountAnimation(targetValue: number, duration: number = 1000) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (targetValue === 0) {
      setDisplayValue(0);
      return;
    }

    let startValue = 0;
    const startTime = Date.now();
    const increment = targetValue / (duration / 16); // ~60fps

    const animateCount = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const currentValue = Math.floor(startValue + increment * (duration / 16) * (elapsed / 16));
      const finalValue = Math.floor(targetValue * progress);

      setDisplayValue(Math.min(finalValue, targetValue));

      if (progress < 1) {
        requestAnimationFrame(animateCount);
      } else {
        setDisplayValue(targetValue);
      }
    };

    requestAnimationFrame(animateCount);
  }, [targetValue, duration]);

  return displayValue;
}
