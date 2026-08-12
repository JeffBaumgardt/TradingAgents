/**
 * @file apps/web/src/components/TrialEndedModal.test.tsx
 * RTL coverage for the non-closeable trial-ended paywall.
 */

import { describe, expect, it, vi } from "vitest";
import TrialEndedModal from "./TrialEndedModal";
import { mockSignOut } from "@/test/mocks/clerk";
import { render, screen, userEvent, within } from "@/test/test-utils";

describe("TrialEndedModal", () => {
  it("shows trial-over copy, plan CTAs, and blocks Escape close", async () => {
    const user = userEvent.setup();
    render(<TrialEndedModal variant="trial_expired" />);

    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByRole("heading", { name: /your free trial is over/i }),
    ).toBeInTheDocument();

    const proLink = screen.getByRole("link", { name: /subscribe to pro/i });
    expect(proLink).toHaveAttribute("href", expect.stringContaining("/checkout?plan=pro"));

    const standardLink = screen.getByRole("link", { name: /subscribe to standard/i });
    expect(standardLink).toHaveAttribute(
      "href",
      expect.stringContaining("/checkout?plan=standard"),
    );

    expect(screen.getByRole("link", { name: /compare plans in detail/i })).toHaveAttribute(
      "href",
      "/pricing",
    );

    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("heading", { name: /your free trial is over/i }),
    ).toBeInTheDocument();
  });

  it("calls Clerk signOut when Sign out is pressed", async () => {
    const user = userEvent.setup();
    render(<TrialEndedModal variant="trial_expired" />);

    await user.click(screen.getByRole("button", { name: /sign out/i }));
    expect(mockSignOut).toHaveBeenCalledWith({ redirectUrl: "/" });
  });

  it("uses subscription-required copy for that variant", () => {
    render(<TrialEndedModal variant="subscription_required" />);
    expect(
      screen.getByRole("heading", { name: /subscribe to keep using tradingagents/i }),
    ).toBeInTheDocument();
  });
});
