export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortId(id: string, head = 8): string {
  return id.length > head ? `${id.slice(0, head)}…` : id;
}

export function titleCase(s: string): string {
  return s.replace(/(^|[\s_-])(\w)/g, (_, sep, c) => `${sep === "_" || sep === "-" ? " " : sep}${c.toUpperCase()}`);
}

export function formatPrice(value: number | string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}
