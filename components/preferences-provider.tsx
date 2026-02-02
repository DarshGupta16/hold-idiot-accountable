"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Density = "cozy" | "compact";

interface PreferencesContextType {
  density: Density;
  setDensity: (density: Density) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(
  undefined,
);

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [density, setDensity] = useState<Density>("cozy");

  useEffect(() => {
    // Check for saved preference on mount
    try {
      const saved = localStorage.getItem("hia-density");
      // Validate that the saved value is a valid Density type
      if (saved === "cozy" || saved === "compact") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setDensity(saved);
      }
    } catch (e) {
      // Ignore localStorage errors
      console.error("Failed to read preference from localStorage", e);
    }
  }, []);

  const updateDensity = useCallback((newDensity: Density) => {
    setDensity(newDensity);
    try {
      localStorage.setItem("hia-density", newDensity);
    } catch (e) {
      console.error("Failed to save preference to localStorage", e);
    }
  }, []);

  const value = useMemo(
    () => ({ density, setDensity: updateDensity }),
    [density, updateDensity],
  );

  // Always render the provider, but use default state during SSR to avoid mismatch
  // The useEffect will update state on client if local storage differs
  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}
