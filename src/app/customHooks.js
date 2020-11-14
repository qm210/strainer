import React from 'react';

// props to https://css-tricks.com/using-requestanimationframe-with-react-hooks/ !!
export const useAnimationFrame = (callback, isRunning) => {
    const request = React.useRef();
    const prevTime = React.useRef();

    React.useEffect(() => {
        const animate = (time) => {
            if (isRunning && prevTime.current !== undefined) {
                callback(time - prevTime.current);
            }
            prevTime.current = time;
            request.current = requestAnimationFrame(animate);
        };

        request.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(request.current);
    }, [callback, isRunning]);
};

export const useLocalStorageState = (key, initialValue) => {
  const [storedValue, setStoredValue] = React.useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    if (value === undefined) {
        return;
    }
    try {
      const valueToStore = (value instanceof Function) ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.log(error);
    }
  };

  return [storedValue, setValue];
};