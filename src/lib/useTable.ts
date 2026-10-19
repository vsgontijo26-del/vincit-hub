"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** CRUD genérico para as tabelas do GESTOR (RLS garante que só o dono vê). */
export function useTable<T = any>(table: string, opts: { select?: string; order?: string; asc?: boolean; filter?: [string, any] } = {}) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(opts);
  const load = useCallback(async () => {
    let q: any = createClient().from(table).select(opts.select || "*");
    if (opts.filter) q = q.eq(opts.filter[0], opts.filter[1]);
    q = q.order(opts.order || "created_at", { ascending: opts.asc ?? false });
    const { data, error } = await q;
    if (error) setError(error.message);
    setRows((data as T[]) || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, key]);
  useEffect(() => { load(); }, [load]);

  async function save(row: any) {
    const s = createClient();
    const { id, ...rest } = row;
    Object.keys(rest).forEach((k) => { if (rest[k] === "") rest[k] = null; if (typeof rest[k] === "object" && rest[k] && !Array.isArray(rest[k]) && k !== "items" && k !== "onboarding") delete rest[k]; });
    const res = id ? await s.from(table).update(rest).eq("id", id).select().single() : await s.from(table).insert(rest).select().single();
    if (res.error) { setError(res.error.message); return null; }
    setError(null); await load();
    return res.data as T;
  }
  async function patch(id: string, values: any) {
    setRows((xs: any) => xs.map((x: any) => (x.id === id ? { ...x, ...values } : x)));
    const { error } = await createClient().from(table).update(values).eq("id", id);
    if (error) { setError(error.message); load(); }
  }
  async function remove(id: string) {
    const { error } = await createClient().from(table).delete().eq("id", id);
    if (error) setError(error.message); else load();
  }
  return { rows, loading, error, reload: load, save, patch, remove, setRows };
}
