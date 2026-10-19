"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Access } from "@/lib/access";

let cache: Access | null = null;
/** acesso do usuário logado (role, status, ferramentas) */
export function useAccess() {
  const [acc, setAcc] = useState<Access | null>(cache);
  useEffect(() => {
    if (cache) return;
    createClient().rpc("my_access").then(({ data }) => { cache = data as Access; setAcc(cache); });
  }, []);
  return acc;
}
