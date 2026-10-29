import { useEffect, useState } from "react";

const aspectNow = (): number => (window.innerHeight > 0 ? window.innerWidth / window.innerHeight : 16 / 9);

/** Width over height of the window, following resizes and turns of a phone. */
export const useViewportAspect = (): number => {
  const [aspect, setAspect] = useState(aspectNow);
  useEffect(() => {
    const update = () => setAspect(aspectNow());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return aspect;
};
