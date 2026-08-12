/**
 * @file apps/web/src/components/SubscriptionGate.test.tsx
 * RTL coverage for SubscriptionGate render paths.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBillingAccount, startBillingTrial } from "@/lib/api-client";
import { SUBSCRIPTION_GATE_POLL_INTERVAL_MS } from "@/lib/subscription-gate-check";
import {
  activePro,
  billingAccount,
  expiredTrial,
  nonePlan,
  openTrial,
} from "@/test/billing-fixtures";
import { setSearchParams } from "@/test/mocks/next";
import { act, render, screen, within } from "@/test/test-utils";
import SubscriptionGate from "./SubscriptionGate";

vi.mock("@/lib/api-client", () => ({
  fetchBillingAccount: vi.fn(),
  startBillingTrial: vi.fn(),
}));

const mockedFetchBillingAccount = vi.mocked(fetchBillingAccount);
const mockedStartBillingTrial = vi.mocked(startBillingTrial);

describe("SubscriptionGate", () => {
  beforeEach(() => {
    mockedFetchBillingAccount.mockReset();
    mockedStartBillingTrial.mockReset();
    setSearchParams();
  });

  it("renders children when the subscription is active", async () => {
    mockedFetchBillingAccount.mockResolvedValue(billingAccount(activePro()));

    render(
      <SubscriptionGate>
        <div>Dashboard</div>
      </SubscriptionGate>,
    );

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(mockedStartBillingTrial).not.toHaveBeenCalled();
  });

  it("shows a non-closeable trial-ended modal when the trial expired", async () => {
    mockedFetchBillingAccount.mockResolvedValue(billingAccount(expiredTrial("pro")));

    render(
      <SubscriptionGate>
        <div>Dashboard</div>
      </SubscriptionGate>,
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByRole("heading", { name: /your free trial is over/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /subscribe to pro/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/checkout?plan=pro"),
    );
    expect(mockedStartBillingTrial).not.toHaveBeenCalled();
  });

  it("auto-starts a Pro trial when there is no plan, then shows children", async () => {
    mockedFetchBillingAccount
      .mockResolvedValueOnce(billingAccount(nonePlan()))
      .mockResolvedValueOnce(billingAccount(openTrial()));
    mockedStartBillingTrial.mockResolvedValue({
      subscription: openTrial(),
      trialEndsAt: openTrial().currentPeriodEnd,
    });

    render(
      <SubscriptionGate>
        <div>Dashboard</div>
      </SubscriptionGate>,
    );

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(mockedStartBillingTrial).toHaveBeenCalledTimes(1);
    expect(mockedStartBillingTrial).toHaveBeenCalledWith("pro");
  });

  it("polls after checkout=1 until the subscription becomes ready", async () => {
    vi.useFakeTimers();
    setSearchParams("checkout=1");

    mockedFetchBillingAccount
      .mockResolvedValueOnce(billingAccount(expiredTrial()))
      .mockResolvedValueOnce(billingAccount(expiredTrial()))
      .mockResolvedValueOnce(billingAccount(activePro()));

    try {
      render(
        <SubscriptionGate>
          <div>Dashboard</div>
        </SubscriptionGate>,
      );

      expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();

      // Flush the initial fetch, then the two 1s waits between poll attempts.
      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SUBSCRIPTION_GATE_POLL_INTERVAL_MS);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(SUBSCRIPTION_GATE_POLL_INTERVAL_MS);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(mockedFetchBillingAccount).toHaveBeenCalledTimes(3);
      expect(mockedStartBillingTrial).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
