/**
 * @file apps/web/src/components/ProfileOnboardingForm.tsx
 * Collect first and last name for email/password sign-ups.
 */

"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { ApiClientError, syncCurrentUser } from "@/lib/api-client";
import styles from "./ProfileOnboardingForm.module.css";

export default function ProfileOnboardingForm() {
  const { user } = useUser();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();

    if (!trimmedFirstName) {
      setError("Please enter your first name.");
      return;
    }

    if (!trimmedLastName) {
      setError("Please enter your last name.");
      return;
    }

    if (!user) {
      setError("Your session expired. Please sign in again.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await syncCurrentUser(user.id, {
        email: user.primaryEmailAddress?.emailAddress ?? null,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        imageUrl: user.imageUrl ?? null,
      });

      await user.update({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
      });

      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "Failed to save your profile. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleFirstNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      document.getElementById("profile-last-name")?.focus();
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.field} htmlFor="profile-first-name">
        First name
        <input
          id="profile-first-name"
          name="firstName"
          type="text"
          autoComplete="given-name"
          value={firstName}
          onChange={(event) => {
            setFirstName(event.target.value);
            setError(null);
          }}
          onKeyDown={handleFirstNameKeyDown}
          aria-label="First name"
          required
        />
      </label>

      <label className={styles.field} htmlFor="profile-last-name">
        Last name
        <input
          id="profile-last-name"
          name="lastName"
          type="text"
          autoComplete="family-name"
          value={lastName}
          onChange={(event) => {
            setLastName(event.target.value);
            setError(null);
          }}
          aria-label="Last name"
          required
        />
      </label>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.primaryButton}
          disabled={submitting}
          aria-label="Continue to TradingAgents"
        >
          {submitting ? "Saving…" : "Continue"}
        </button>
      </div>
    </form>
  );
}
