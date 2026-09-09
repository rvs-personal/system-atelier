'use client';
import { createContext, useContext } from 'react';
export type User = { id: string; username: string };
export const AuthContext = createContext<{
  user: User;
  logout: () => void;
} | null>(null);
export const useAccount = () => useContext(AuthContext);
