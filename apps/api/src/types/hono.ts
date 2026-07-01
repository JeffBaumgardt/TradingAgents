import type { Context } from "hono";

declare module "hono" {
  interface ContextVariableMap {
    userId: string;
  }
}

export type AppContext = Context;
