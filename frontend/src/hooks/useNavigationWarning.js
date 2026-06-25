import { useContext, useEffect, useRef } from "react";
import { UNSAFE_NavigationContext, useLocation } from "react-router-dom";

export default function useNavigationWarning({
  enabled,
  message,
  shouldBlockNavigation,
}) {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const location = useLocation();
  const shouldBlockRef = useRef(shouldBlockNavigation);

  useEffect(() => {
    shouldBlockRef.current = shouldBlockNavigation;
  }, [shouldBlockNavigation]);

  useEffect(() => {
    if (!enabled || typeof navigator?.block !== "function") return undefined;

    const unblock = navigator.block((transition) => {
      const shouldBlock = shouldBlockRef.current
        ? shouldBlockRef.current({
            currentLocation: location,
            nextLocation: transition.location,
          })
        : true;

      if (shouldBlock && !window.confirm(message)) {
        return;
      }

      unblock();
      transition.retry();
    });

    return unblock;
  }, [enabled, location, message, navigator]);

  useEffect(() => {
    if (!enabled) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled]);
}
