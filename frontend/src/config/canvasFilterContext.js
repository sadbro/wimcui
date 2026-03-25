import { createContext, useContext } from "react";

export const CanvasFilterContext = createContext("all");

export function useCanvasFilter() {
  return useContext(CanvasFilterContext);
}

export const SecurityOverlayContext = createContext(false);

export function useSecurityOverlay() {
  return useContext(SecurityOverlayContext);
}
