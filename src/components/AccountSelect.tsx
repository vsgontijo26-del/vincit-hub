"use client";
export default function AccountSelect({ accounts, value, onChange }: { accounts: any[]; value: string; onChange: (v: string) => void }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Sem perfil específico</option>
      {accounts.map((a) => <option key={a.id} value={a.id}>@{a.username}</option>)}
    </select>
  );
}
