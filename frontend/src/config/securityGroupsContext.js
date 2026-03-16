import { createContext } from "react";

// Provides securityGroups array to any component in the tree
// without prop drilling through every layer
export const SecurityGroupsContext = createContext([]);