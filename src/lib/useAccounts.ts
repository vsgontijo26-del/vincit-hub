"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export function useAccounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const { data } = await createClient().from("ig_accounts").select("*").order("created_at");
    setAccounts(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  return { accounts, loading, reload: load };
}

export const fmt = (n: any) => (n == null ? "–" : Intl.NumberFormat("pt-BR", { notation: n >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n));
