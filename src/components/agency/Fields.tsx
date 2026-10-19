"use client";
export type Field = { key: string; label: string; type?: "text" | "number" | "date" | "datetime" | "textarea" | "select" | "email" | "money" | "checkbox"; options?: { v: string; l: string }[] | string[]; span?: 1 | 2; placeholder?: string; required?: boolean };

export default function Fields({ fields, value, onChange }: { fields: Field[]; value: any; onChange: (v: any) => void }) {
  const set = (k: string, v: any) => onChange({ ...value, [k]: v });
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {fields.map((f) => {
        const v = value?.[f.key] ?? "";
        const opts = (f.options || []).map((o: any) => (typeof o === "string" ? { v: o, l: o } : o));
        return (
          <div key={f.key} className={f.span === 2 || f.type === "textarea" ? "md:col-span-2" : ""}>
            {f.type !== "checkbox" && <label className="label">{f.label}</label>}
            {f.type === "textarea" ? (
              <textarea className="input" value={v} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
            ) : f.type === "select" ? (
              <select className="input" value={v} required={f.required} onChange={(e) => set(f.key, e.target.value)}>
                <option value="">–</option>
                {opts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            ) : f.type === "checkbox" ? (
              <label className="flex items-center gap-2 text-sm mt-6"><input type="checkbox" checked={!!v} onChange={(e) => set(f.key, e.target.checked)} className="accent-[var(--color-mint)] w-4 h-4" />{f.label}</label>
            ) : (
              <input className="input" required={f.required} placeholder={f.placeholder}
                type={f.type === "money" || f.type === "number" ? "number" : f.type === "datetime" ? "datetime-local" : f.type || "text"}
                step={f.type === "money" ? "0.01" : undefined}
                value={f.type === "datetime" && v ? String(v).slice(0, 16) : v}
                onChange={(e) => set(f.key, f.type === "money" || f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)} />
            )}
          </div>
        );
      })}
    </div>
  );
}
