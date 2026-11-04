import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface ActiveFamilyContextType {
  activeFamilyId: string | null;
  setActiveFamilyId: (familyId: string) => void;
}

const ActiveFamilyContext = createContext<ActiveFamilyContextType>({ activeFamilyId: null, setActiveFamilyId: () => {} });

export const useActiveFamily = () => useContext(ActiveFamilyContext);

const storageKey = (userId: string) => `evernest-active-family:${userId}`;

// This only remembers which family to show. What a user may see is decided by RLS.
export function ActiveFamilyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [activeFamilyId, setActiveFamily] = useState<string | null>(null);

  useEffect(() => {
    setActiveFamily(userId ? localStorage.getItem(storageKey(userId)) : null);
  }, [userId]);

  const setActiveFamilyId = useCallback((familyId: string) => {
    if (userId) localStorage.setItem(storageKey(userId), familyId);
    setActiveFamily(familyId);
  }, [userId]);

  return (
    <ActiveFamilyContext.Provider value={{ activeFamilyId, setActiveFamilyId }}>
      {children}
    </ActiveFamilyContext.Provider>
  );
}
