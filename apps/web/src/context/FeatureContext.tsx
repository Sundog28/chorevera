import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getFeatureAccess,
} from "../api/features";

import type {
  FeatureAccess,
} from "../types/features";


type FeatureContextValue = {
  features: FeatureAccess | null;
  isFeaturesLoading: boolean;
  featuresError: string;
  refreshFeatures: () => Promise<void>;
  canUseAnalytics: boolean;
  canUseAdvancedReminders: boolean;
  canUseHouseholdSharing: boolean;
  canUseAiPlanning: boolean;
};


const FeatureContext =
  createContext<FeatureContextValue | null>(
    null,
  );


type FeatureProviderProps = {
  children: ReactNode;
};


function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Unable to load your plan features.";
}


export function FeatureProvider({
  children,
}: FeatureProviderProps) {
  const [features, setFeatures] =
    useState<FeatureAccess | null>(null);

  const [
    isFeaturesLoading,
    setIsFeaturesLoading,
  ] = useState(true);

  const [
    featuresError,
    setFeaturesError,
  ] = useState("");


  const refreshFeatures =
    useCallback(async (): Promise<void> => {
      setFeaturesError("");

      try {
        const featureAccess =
          await getFeatureAccess();

        setFeatures(featureAccess);
      } catch (error) {
        setFeaturesError(
          getErrorMessage(error),
        );
      } finally {
        setIsFeaturesLoading(false);
      }
    }, []);


  useEffect(() => {
    void refreshFeatures();
  }, [refreshFeatures]);


  const value =
    useMemo<FeatureContextValue>(
      () => ({
        features,
        isFeaturesLoading,
        featuresError,
        refreshFeatures,
        canUseAnalytics:
          features?.analytics ?? false,
        canUseAdvancedReminders:
          features?.advanced_reminders ??
          false,
        canUseHouseholdSharing:
          features?.household_sharing ??
          false,
        canUseAiPlanning:
          features?.ai_planning ?? false,
      }),
      [
        features,
        isFeaturesLoading,
        featuresError,
        refreshFeatures,
      ],
    );


  return (
    <FeatureContext.Provider value={value}>
      {children}
    </FeatureContext.Provider>
  );
}


export function useFeatures():
FeatureContextValue {
  const context =
    useContext(FeatureContext);

  if (!context) {
    throw new Error(
      "useFeatures must be used inside FeatureProvider.",
    );
  }

  return context;
}