/**
 * @file apps/web/src/app/(marketing)/layout.tsx
 * Marketing layout — guest landing chrome; signed-in users keep app header context.
 */

import MarketingLayoutChrome from "@/components/MarketingLayoutChrome";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <MarketingLayoutChrome>{children}</MarketingLayoutChrome>;
}
