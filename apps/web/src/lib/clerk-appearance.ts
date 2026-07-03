/**
 * @file apps/web/src/lib/clerk-appearance.ts
 * Shared Clerk appearance mapped to TradingAgents CSS theme tokens.
 *
 * Colors reference `var(--clerk-*)` custom properties defined in globals.css so
 * sign-in, sign-up, modals, and the user menu follow the active app theme.
 */

/** CSS custom property names consumed by Clerk appearance styling. */
export const CLERK_THEME_CSS_VARS = [
  "--clerk-bg",
  "--clerk-bg-deep",
  "--clerk-bg-muted",
  "--clerk-bg-hover",
  "--clerk-bg-active",
  "--clerk-border",
  "--clerk-border-strong",
  "--clerk-text",
  "--clerk-text-muted",
  "--clerk-text-subtle",
  "--clerk-primary",
  "--clerk-primary-hover",
  "--clerk-primary-fg",
  "--clerk-danger",
  "--clerk-focus-ring",
  "--clerk-primary-button-bg",
  "--clerk-primary-button-border",
  "--clerk-primary-button-text",
  "--clerk-primary-button-hover-bg",
  "--clerk-primary-button-hover-border",
  "--clerk-badge-bg",
  "--clerk-badge-border",
  "--clerk-badge-text",
  "--clerk-modal-backdrop",
  "--clerk-card-shadow",
  "--clerk-modal-shadow",
  "--clerk-menu-shadow",
] as const;

const cssVar = (name: (typeof CLERK_THEME_CSS_VARS)[number]) => `var(${name})`;

export const clerkAppearance = {
  variables: {
    colorBackground: cssVar("--clerk-bg"),
    colorInputBackground: cssVar("--clerk-bg-deep"),
    colorInput: cssVar("--clerk-bg-deep"),
    colorInputForeground: cssVar("--clerk-text"),
    colorText: cssVar("--clerk-text"),
    colorTextSecondary: cssVar("--clerk-text-muted"),
    colorForeground: cssVar("--clerk-text"),
    colorMutedForeground: cssVar("--clerk-text-subtle"),
    colorMuted: cssVar("--clerk-bg-muted"),
    colorNeutral: cssVar("--clerk-text-muted"),
    colorPrimary: cssVar("--clerk-primary"),
    colorPrimaryForeground: cssVar("--clerk-primary-fg"),
    colorDanger: cssVar("--clerk-danger"),
    colorBorder: cssVar("--clerk-border"),
    colorModalBackdrop: cssVar("--clerk-modal-backdrop"),
    borderRadius: "0.5rem",
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  elements: {
    card: {
      backgroundColor: cssVar("--clerk-bg"),
      border: `1px solid ${cssVar("--clerk-border")}`,
      boxShadow: cssVar("--clerk-card-shadow"),
    },
    modalContent: {
      backgroundColor: cssVar("--clerk-bg"),
      border: `1px solid ${cssVar("--clerk-border")}`,
      boxShadow: cssVar("--clerk-modal-shadow"),
    },
    modalCloseButton: {
      color: cssVar("--clerk-text-muted"),
      "&:hover": {
        color: cssVar("--clerk-text"),
        backgroundColor: cssVar("--clerk-bg-hover"),
      },
    },
    navbar: {
      backgroundColor: cssVar("--clerk-bg-deep"),
      borderRight: `1px solid ${cssVar("--clerk-border")}`,
    },
    navbarButton: {
      color: cssVar("--clerk-text-muted"),
      "&:hover": {
        backgroundColor: cssVar("--clerk-bg-hover"),
        color: cssVar("--clerk-text"),
      },
    },
    navbarButtonIcon: {
      color: cssVar("--clerk-text-muted"),
    },
    navbarButton__active: {
      backgroundColor: cssVar("--clerk-bg-active"),
      color: cssVar("--clerk-text"),
    },
    pageScrollBox: {
      backgroundColor: cssVar("--clerk-bg"),
    },
    page: {
      backgroundColor: cssVar("--clerk-bg"),
    },
    headerTitle: {
      color: cssVar("--clerk-text"),
      fontWeight: 600,
    },
    headerSubtitle: {
      color: cssVar("--clerk-text-subtle"),
    },
    profileSectionTitleText: {
      color: cssVar("--clerk-text-subtle"),
      fontSize: "0.75rem",
      letterSpacing: "0.04em",
      textTransform: "uppercase",
    },
    profileSectionContent: {
      backgroundColor: cssVar("--clerk-bg-deep"),
      border: `1px solid ${cssVar("--clerk-border")}`,
      borderRadius: "0.5rem",
    },
    profileSectionPrimaryButton: {
      color: cssVar("--clerk-primary"),
      "&:hover": {
        color: cssVar("--clerk-primary-hover"),
      },
    },
    menuList: {
      backgroundColor: cssVar("--clerk-bg"),
      border: `1px solid ${cssVar("--clerk-border")}`,
      boxShadow: cssVar("--clerk-menu-shadow"),
    },
    menuItem: {
      color: cssVar("--clerk-text-muted"),
      "&:hover": {
        backgroundColor: cssVar("--clerk-bg-hover"),
        color: cssVar("--clerk-text"),
      },
    },
    menuButton: {
      color: cssVar("--clerk-text-muted"),
      "&:hover": {
        backgroundColor: cssVar("--clerk-bg-hover"),
        color: cssVar("--clerk-text"),
      },
    },
    userButtonPopoverCard: {
      backgroundColor: cssVar("--clerk-bg"),
      border: `1px solid ${cssVar("--clerk-border")}`,
      boxShadow: cssVar("--clerk-menu-shadow"),
    },
    userButtonAvatarBox: {
      width: "2rem",
      height: "2rem",
    },
    userButtonPopoverActionButton: {
      color: cssVar("--clerk-text-muted"),
      "&:hover": {
        backgroundColor: cssVar("--clerk-bg-hover"),
        color: cssVar("--clerk-text"),
      },
    },
    userButtonPopoverActionButtonText: {
      color: "inherit",
    },
    userButtonPopoverActionButtonIcon: {
      color: "inherit",
    },
    userButtonPopoverFooter: {
      borderTop: `1px solid ${cssVar("--clerk-border")}`,
      backgroundColor: cssVar("--clerk-bg-deep"),
    },
    userPreviewMainIdentifier: {
      color: cssVar("--clerk-text"),
      fontWeight: 600,
    },
    userPreviewSecondaryIdentifier: {
      color: cssVar("--clerk-text-subtle"),
    },
    formFieldLabel: {
      color: cssVar("--clerk-text-muted"),
    },
    formFieldInput: {
      backgroundColor: cssVar("--clerk-bg-deep"),
      border: `1px solid ${cssVar("--clerk-border-strong")}`,
      color: cssVar("--clerk-text"),
      "&:focus": {
        borderColor: cssVar("--clerk-primary"),
        boxShadow: `0 0 0 2px color-mix(in srgb, ${cssVar("--clerk-focus-ring")} 25%, transparent)`,
      },
    },
    formButtonPrimary: {
      backgroundColor: cssVar("--clerk-primary-button-bg"),
      border: `1px solid ${cssVar("--clerk-primary-button-border")}`,
      color: cssVar("--clerk-primary-button-text"),
      boxShadow: "none",
      fontWeight: 600,
      "&:hover": {
        backgroundColor: cssVar("--clerk-primary-button-hover-bg"),
        borderColor: cssVar("--clerk-primary-button-hover-border"),
      },
    },
    formButtonReset: {
      color: cssVar("--clerk-text-muted"),
      "&:hover": {
        backgroundColor: cssVar("--clerk-bg-hover"),
        color: cssVar("--clerk-text"),
      },
    },
    badge: {
      backgroundColor: cssVar("--clerk-badge-bg"),
      color: cssVar("--clerk-badge-text"),
      border: `1px solid ${cssVar("--clerk-badge-border")}`,
    },
    footerActionLink: {
      color: cssVar("--clerk-primary"),
      "&:hover": {
        color: cssVar("--clerk-primary-hover"),
      },
    },
    dividerLine: {
      backgroundColor: cssVar("--clerk-border-strong"),
    },
    dividerText: {
      color: cssVar("--clerk-text-subtle"),
    },
    socialButtonsBlockButton: {
      backgroundColor: "#ffffff",
      color: "#3c4043",
      border: "1px solid #dadce0",
      boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.12)",
      height: "2.5rem",
      "&:hover": {
        backgroundColor: "#f8f9fa",
        borderColor: "#c6c6c6",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.16)",
      },
      "&:focus": {
        backgroundColor: "#f8f9fa",
        borderColor: "#4285f4",
        boxShadow: "0 0 0 2px rgba(66, 133, 244, 0.25)",
      },
    },
    socialButtonsBlockButtonText: {
      color: "#3c4043",
      fontWeight: 500,
    },
    socialButtonsProviderIcon: {
      width: "1.125rem",
      height: "1.125rem",
    },
  },
};
