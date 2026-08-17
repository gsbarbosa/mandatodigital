function pad2(value: number) {
  return String(value).padStart(2, "0");
}

/** ISO UTC → valor de `<input type="datetime-local">` no fuso do usuário. */
export function isoToDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** Valor de datetime-local (horário local) → ISO UTC. */
export function datetimeLocalToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) {
    return null;
  }
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    0,
    0,
  );
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}
