import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Register Next / Clerk module mocks (side effects).
import "./mocks/clerk";
import "./mocks/next";

import {
  mockSignOut,
  mockUseAuth,
  mockUseClerk,
  mockUseUser,
} from "./mocks/clerk";
import {
  mockRouterPush,
  mockRouterReplace,
  setSearchParams,
} from "./mocks/next";

afterEach(() => {
  cleanup();
  setSearchParams();
  mockRouterPush.mockClear();
  mockRouterReplace.mockClear();
  mockSignOut.mockClear();
  mockUseAuth.mockClear();
  mockUseUser.mockClear();
  mockUseClerk.mockClear();
});
