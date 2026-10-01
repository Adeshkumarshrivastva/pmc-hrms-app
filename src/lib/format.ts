const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export const formatINR = (n: number) => inr.format(n);

/** Salary-slip style: "16,000" for whole rupees, "1,066.67" otherwise; "Nil" for zero when nil is set. */
export function formatAmount(n: number, nil = false): string {
  if (nil && n === 0) return "Nil";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
  "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) { parts.push(ONES[Math.floor(n / 100)], "Hundred"); n %= 100; }
  if (n >= 20) { parts.push(TENS[Math.floor(n / 10)]); n %= 10; }
  if (n > 0) parts.push(ONES[n]);
  return parts.join(" ");
}

/** Indian numbering system (lakh / crore), e.g. "Rupees Thirty Two Thousand Only". */
export function amountInWords(amount: number): string {
  let rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Rupees Zero Only";

  const units: [number, string][] = [[10_000_000, "Crore"], [100_000, "Lakh"], [1000, "Thousand"]];
  const parts: string[] = [];
  for (const [size, label] of units) {
    if (rupees >= size) { parts.push(below1000(Math.floor(rupees / size)), label); rupees %= size; }
  }
  if (rupees > 0) parts.push(below1000(rupees));

  let words = `Rupees ${parts.join(" ") || "Zero"}`;
  if (paise) words += ` and ${below1000(paise)} Paise`;
  return `${words} Only`;
}
