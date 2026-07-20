/**
 * @file apps/web/src/components/pricing/CheckoutLoading.tsx
 * Suspense fallback for the checkout scaffold page.
 */

import styles from "./CheckoutLoading.module.css";

export default function CheckoutLoading() {
  return <p className={styles.loading}>Loading checkout…</p>;
}
