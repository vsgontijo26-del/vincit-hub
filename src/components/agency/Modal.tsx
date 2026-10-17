"use client";
import { useEffect } from "react";
export default function Modal({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6" onClick={onClose}>
      <div className={`w-full ${wide ? "md:max-w-3xl" : "md:max-w-xl"} max-h-[92vh] overflow-y-auto bg-panel border border-line rounded-t-2xl md:rounded-2xl p-5 md:p-6 rise`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-bold text-xl">{title}</h2>
          <button onClick={onClose} className="text-fog hover:text-paper text-sm">Fechar</button>
        </div>
        {children}
      </div>
    </div>
  );
}
