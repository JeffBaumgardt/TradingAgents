/**
 * @file apps/web/src/lib/clerk-appearance.ts
 * Shared Clerk appearance tuned for the TradingAgents dark UI.
 */

const palette = {
  background: "#121820",
  backgroundDeep: "#0f1419",
  border: "#243041",
  borderStrong: "#3a4a5c",
  text: "#e7ecf1",
  textMuted: "#b8c5d3",
  textSubtle: "#9aa7b5",
  primary: "#6eb6ff",
  primaryForeground: "#0f1419",
  danger: "#ff8a8a",
  modalBackdrop: "rgba(5, 10, 16, 0.72)",
};

export const clerkAppearance = {
  variables: {
    colorBackground: palette.background,
    colorInputBackground: palette.backgroundDeep,
    colorInput: palette.backgroundDeep,
    colorInputForeground: palette.text,
    colorText: palette.text,
    colorTextSecondary: palette.textMuted,
    colorForeground: palette.text,
    colorMutedForeground: palette.textSubtle,
    colorMuted: "#1a2430",
    colorNeutral: palette.textMuted,
    colorPrimary: palette.primary,
    colorPrimaryForeground: palette.primaryForeground,
    colorDanger: palette.danger,
    colorBorder: palette.border,
    colorModalBackdrop: palette.modalBackdrop,
    borderRadius: "0.5rem",
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  elements: {
    card: {
      backgroundColor: palette.background,
      border: `1px solid ${palette.border}`,
      boxShadow: "0 16px 48px rgba(0, 0, 0, 0.45)",
    },
    modalContent: {
      backgroundColor: palette.background,
      border: `1px solid ${palette.border}`,
      boxShadow: "0 24px 64px rgba(0, 0, 0, 0.55)",
    },
    modalCloseButton: {
      color: palette.textMuted,
      "&:hover": {
        color: palette.text,
        backgroundColor: "#1a2430",
      },
    },
    navbar: {
      backgroundColor: palette.backgroundDeep,
      borderRight: `1px solid ${palette.border}`,
    },
    navbarButton: {
      color: palette.textMuted,
      "&:hover": {
        backgroundColor: "#1a2430",
        color: palette.text,
      },
    },
    navbarButtonIcon: {
      color: palette.textMuted,
    },
    navbarButton__active: {
      backgroundColor: "#1a3a5c",
      color: palette.text,
    },
    pageScrollBox: {
      backgroundColor: palette.background,
    },
    page: {
      backgroundColor: palette.background,
    },
    headerTitle: {
      color: palette.text,
      fontWeight: 600,
    },
    headerSubtitle: {
      color: palette.textSubtle,
    },
    profileSectionTitleText: {
      color: palette.textSubtle,
      fontSize: "0.75rem",
      letterSpacing: "0.04em",
      textTransform: "uppercase",
    },
    profileSectionContent: {
      backgroundColor: palette.backgroundDeep,
      border: `1px solid ${palette.border}`,
      borderRadius: "0.5rem",
    },
    profileSectionPrimaryButton: {
      color: palette.primary,
      "&:hover": {
        color: "#9fd0ff",
      },
    },
    menuList: {
      backgroundColor: palette.background,
      border: `1px solid ${palette.border}`,
      boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4)",
    },
    menuItem: {
      color: palette.textMuted,
      "&:hover": {
        backgroundColor: "#1a2430",
        color: palette.text,
      },
    },
    menuButton: {
      color: palette.textMuted,
      "&:hover": {
        backgroundColor: "#1a2430",
        color: palette.text,
      },
    },
    userButtonPopoverCard: {
      backgroundColor: palette.background,
      border: `1px solid ${palette.border}`,
      boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4)",
    },
    userButtonAvatarBox: {
      width: "2rem",
      height: "2rem",
    },
    userButtonPopoverActionButton: {
      color: palette.textMuted,
      "&:hover": {
        backgroundColor: "#1a2430",
        color: palette.text,
      },
    },
    userButtonPopoverActionButtonText: {
      color: "inherit",
    },
    userButtonPopoverActionButtonIcon: {
      color: "inherit",
    },
    userButtonPopoverFooter: {
      borderTop: `1px solid ${palette.border}`,
      backgroundColor: palette.backgroundDeep,
    },
    userPreviewMainIdentifier: {
      color: palette.text,
      fontWeight: 600,
    },
    userPreviewSecondaryIdentifier: {
      color: palette.textSubtle,
    },
    formFieldLabel: {
      color: palette.textMuted,
    },
    formFieldInput: {
      backgroundColor: palette.backgroundDeep,
      border: `1px solid ${palette.borderStrong}`,
      color: palette.text,
      "&:focus": {
        borderColor: palette.primary,
        boxShadow: `0 0 0 2px rgba(110, 182, 255, 0.2)`,
      },
    },
    formButtonPrimary: {
      backgroundColor: "#1a3a5c",
      border: `1px solid #2a5a8c`,
      color: palette.text,
      boxShadow: "none",
      "&:hover": {
        backgroundColor: "#234a72",
        borderColor: palette.primary,
      },
    },
    formButtonReset: {
      color: palette.textMuted,
      "&:hover": {
        backgroundColor: "#1a2430",
        color: palette.text,
      },
    },
    badge: {
      backgroundColor: "#1a3a5c",
      color: palette.primary,
      border: `1px solid #2a5a8c`,
    },
    footerActionLink: {
      color: palette.primary,
      "&:hover": {
        color: "#9fd0ff",
      },
    },
    dividerLine: {
      backgroundColor: palette.borderStrong,
    },
    dividerText: {
      color: palette.textSubtle,
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
