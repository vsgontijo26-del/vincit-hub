/** Gera o "Pix copia e cola" (BR Code estático, padrão EMV do Banco Central) */
const f = (id: string, v: string) => id + String(v.length).padStart(2, "0") + v;
const clean = (s: string, n: number) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().slice(0, n).trim();

function crc16(s: string) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function pixPayload({ key, name, city, amount, txid, description }: { key: string; name: string; city: string; amount?: number; txid?: string; description?: string }) {
  let k = (key || "").trim();
  // telefone: +55DDDNUMERO; CPF/CNPJ: só dígitos
  if (/^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/.test(k) && !k.includes("@")) k = "+55" + k.replace(/\D/g, "");
  else if (/^[\d.\-/]+$/.test(k)) k = k.replace(/\D/g, "");
  const gui = f("00", "br.gov.bcb.pix") + f("01", k) + (description ? f("02", clean(description, 40)) : "");
  let p = f("00", "01") + f("26", gui) + f("52", "0000") + f("53", "986");
  if (amount && amount > 0) p += f("54", amount.toFixed(2));
  p += f("58", "BR") + f("59", clean(name, 25) || "RECEBEDOR") + f("60", clean(city, 15) || "BRASIL");
  p += f("62", f("05", (txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***"));
  p += "6304";
  return p + crc16(p);
}

/** Valor atualizado: desconto até X dias antes, multa + juros pró-rata após o vencimento */
export function chargeAmount(c: { amount: number; due_date: string; fine_pct?: number; interest_pct?: number; discount_value?: number; discount_days?: number }, today: string) {
  const amount = Number(c.amount);
  const due = new Date(c.due_date + "T12:00:00");
  const now = new Date(today + "T12:00:00");
  const daysLate = Math.floor((now.getTime() - due.getTime()) / 864e5);
  if (daysLate > 0) {
    const fine = amount * (Number(c.fine_pct) || 0) / 100;
    const interest = amount * ((Number(c.interest_pct) || 0) / 100 / 30) * daysLate;
    return { value: amount + fine + interest, fine, interest, discount: 0, daysLate };
  }
  const limit = new Date(due.getTime() - (Number(c.discount_days) || 0) * 864e5);
  const discount = Number(c.discount_value) > 0 && now <= limit ? Number(c.discount_value) : 0;
  return { value: amount - discount, fine: 0, interest: 0, discount, daysLate: 0 };
}
