type P = { className?: string };
const b = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24" };
export const A = {
  home: (p: P) => (<svg {...b} className={p.className}><path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>),
  film: (p: P) => (<svg {...b} className={p.className}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>),
  check: (p: P) => (<svg {...b} className={p.className}><rect x="3" y="3" width="18" height="18" rx="4"/><path d="m8 12 3 3 5-6"/></svg>),
  cal: (p: P) => (<svg {...b} className={p.className}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>),
  users: (p: P) => (<svg {...b} className={p.className}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.2 3.8 5"/></svg>),
  funnel: (p: P) => (<svg {...b} className={p.className}><path d="M3 4h18l-7 8v6l-4 2v-8z"/></svg>),
  doc: (p: P) => (<svg {...b} className={p.className}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>),
  money: (p: P) => (<svg {...b} className={p.className}><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/></svg>),
  team: (p: P) => (<svg {...b} className={p.className}><circle cx="12" cy="7" r="3"/><path d="M6 21v-1a6 6 0 0 1 12 0v1"/><circle cx="4.5" cy="10" r="2"/><circle cx="19.5" cy="10" r="2"/></svg>),
  gear: (p: P) => (<svg {...b} className={p.className}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>),
  ext: (p: P) => (<svg {...b} className={p.className}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>),
  clock: (p: P) => (<svg {...b} className={p.className}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>),
  alert: (p: P) => (<svg {...b} className={p.className}><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.01"/></svg>),
  chevL: (p: P) => (<svg {...b} className={p.className}><path d="m15 6-6 6 6 6"/></svg>),
  chevR: (p: P) => (<svg {...b} className={p.className}><path d="m9 6 6 6-6 6"/></svg>),
};
