import { createContext } from "react";

// Provides roles array to any component in the tree
// without prop drilling through every layer
export const RolesContext = createContext([]);