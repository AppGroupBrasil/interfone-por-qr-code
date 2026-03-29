import { useState, useCallback } from "react";

const DEMO_KEY = "appinterfone_demo";

export function isDemoMode(): boolean {
  try {
    return localStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDemoMode(active: boolean) {
  try {
    if (active) localStorage.setItem(DEMO_KEY, "1");
    else localStorage.removeItem(DEMO_KEY);
  } catch {}
}

/**
 * Hook that gates mutating actions in demo mode.
 * Returns { isDemo, guardAction, showTrialModal, closeTrialModal }
 *
 * Usage:
 *   const { isDemo, guardAction, showTrialModal, closeTrialModal } = useDemoGuard();
 *   <button onClick={guardAction(() => doRealAction())}>Salvar</button>
 *   <DemoTrialModal open={showTrialModal} onClose={closeTrialModal} />
 */
export function useDemoGuard() {
  const isDemo = isDemoMode();
  const [showTrialModal, setShowTrialModal] = useState(false);

  const guardAction = useCallback(
    (realAction: () => void) => {
      return () => {
        if (isDemo) {
          setShowTrialModal(true);
        } else {
          realAction();
        }
      };
    },
    [isDemo]
  );

  const closeTrialModal = useCallback(() => setShowTrialModal(false), []);

  return { isDemo, guardAction, showTrialModal, setShowTrialModal, closeTrialModal };
}
