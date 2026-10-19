"use client";
import { createContext, useContext } from "react";
export type Brand = { logo?: string | null; name?: string | null; color?: string | null };
const Ctx = createContext<Brand>({});
export function BrandProvider({ value, children }: { value: Brand; children: React.ReactNode }) { return <Ctx.Provider value={value}>{children}</Ctx.Provider>; }
export const useBrand = () => useContext(Ctx);
