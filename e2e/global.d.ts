import type { DebugApi } from "../packages/app/src/debug-api";

declare global {
  interface Window {
    __seki?: DebugApi;
  }
}
