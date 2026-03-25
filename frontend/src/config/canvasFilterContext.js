import { createContext, useContext } from "react";

export const CanvasFilterContext = createContext("all");

export function useCanvasFilter() {
  return useContext(CanvasFilterContext);
}
