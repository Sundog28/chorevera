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
  createBillingPortal,
  createCheckoutSession,
  getBillingStatus,
} from "../api/billing";

import type {
  BillingStatus,
  PaidBillingPlan,
} from "../types/billing";


type BillingContextValue = {
  billingStatus: BillingStatus | null;
  isBillingLoading: boolean;
  isCheckoutLoading: boolean;
  isPortalLoading: boolean;
  billingError: string;
  billingMessage: string;
  refreshBillingStatus: () => Promise<void>;
  beginCheckout: (
    plan: PaidBillingPlan,
  ) => Promise<void>;
  openBillingPortal: () => Promise<void>;
};


const BillingContext =
  createContext<BillingContextValue | null>(null);


type BillingProviderProps = {
  children: ReactNode;
};


function getErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  return error instanceof Error
    ? error.message
    : fallbackMessage;
}


function wait(milliseconds: number):
Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}


export function BillingProvider({
  children,
}: BillingProviderProps) {
  const [billingStatus, setBillingStatus] =
    useState<BillingStatus | null>(null);

  const [
    isBillingLoading,
    setIsBillingLoading,
  ] = useState(true);

  const [
    isCheckoutLoading,
    setIsCheckoutLoading,
  ] = useState(false);

  const [
    isPortalLoading,
    setIsPortalLoading,
  ] = useState(false);

  const [billingError, setBillingError] =
    useState("");

  const [billingMessage, setBillingMessage] =
    useState("");


  const refreshBillingStatus =
    useCallback(async (): Promise<void> => {
      setBillingError("");

      try {
        const status =
          await getBillingStatus();

        setBillingStatus(status);
      } catch (error) {
        setBillingError(
          getErrorMessage(
            error,
            "Unable to load billing status.",
          ),
        );
      } finally {
        setIsBillingLoading(false);
      }
    }, []);


  useEffect(() => {
    void refreshBillingStatus();
  }, [refreshBillingStatus]);


  useEffect(() => {
    const searchParameters =
      new URLSearchParams(
        window.location.search,
      );

    const checkoutResult =
      searchParameters.get("checkout");

    if (!checkoutResult) {
      return;
    }

    async function handleCheckoutReturn() {
      if (checkoutResult === "success") {
        setBillingMessage(
          "Payment completed. Chorevera is confirming your subscription.",
        );

        /*
         * The Stripe webhook can arrive shortly
         * after the browser returns from Checkout.
         * Poll briefly for the synchronized status.
         */
        for (
          let attempt = 0;
          attempt < 6;
          attempt += 1
        ) {
          try {
            const status =
              await getBillingStatus();

            setBillingStatus(status);

            if (status.is_paid) {
              setBillingMessage(
                `Your ${status.plan_name} plan is active.`,
              );

              break;
            }
          } catch (error) {
            setBillingError(
              getErrorMessage(
                error,
                "Unable to confirm the subscription.",
              ),
            );

            break;
          }

          await wait(1500);
        }
      }

      if (checkoutResult === "cancelled") {
        setBillingMessage(
          "Checkout was cancelled. Your current plan was not changed.",
        );
      }

      const cleanUrl =
        `${window.location.pathname}` +
        `${window.location.hash}`;

      window.history.replaceState(
        {},
        document.title,
        cleanUrl,
      );
    }

    void handleCheckoutReturn();
  }, []);


  async function beginCheckout(
    plan: PaidBillingPlan,
  ): Promise<void> {
    if (isCheckoutLoading) {
      return;
    }

    setIsCheckoutLoading(true);
    setBillingError("");
    setBillingMessage("");

    try {
      const response =
        await createCheckoutSession(plan);

      window.location.assign(
        response.checkout_url,
      );
    } catch (error) {
      setBillingError(
        getErrorMessage(
          error,
          "Unable to begin Stripe Checkout.",
        ),
      );

      setIsCheckoutLoading(false);
    }
  }


  async function openBillingPortal():
  Promise<void> {
    if (isPortalLoading) {
      return;
    }

    setIsPortalLoading(true);
    setBillingError("");
    setBillingMessage("");

    try {
      const response =
        await createBillingPortal();

      window.location.assign(
        response.portal_url,
      );
    } catch (error) {
      setBillingError(
        getErrorMessage(
          error,
          "Unable to open billing management.",
        ),
      );

      setIsPortalLoading(false);
    }
  }


  const value =
    useMemo<BillingContextValue>(
      () => ({
        billingStatus,
        isBillingLoading,
        isCheckoutLoading,
        isPortalLoading,
        billingError,
        billingMessage,
        refreshBillingStatus,
        beginCheckout,
        openBillingPortal,
      }),
      [
        billingStatus,
        isBillingLoading,
        isCheckoutLoading,
        isPortalLoading,
        billingError,
        billingMessage,
        refreshBillingStatus,
      ],
    );


  return (
    <BillingContext.Provider value={value}>
      {children}
    </BillingContext.Provider>
  );
}


export function useBilling():
BillingContextValue {
  const context =
    useContext(BillingContext);

  if (!context) {
    throw new Error(
      "useBilling must be used inside BillingProvider.",
    );
  }

  return context;
}
