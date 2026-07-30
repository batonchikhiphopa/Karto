export function russianCount(
  count: number,
  one: string,
  few: string,
  many: string
): string {
  const modulo100 = Math.abs(count) % 100;
  const modulo10 = modulo100 % 10;
  const form = modulo100 >= 11 && modulo100 <= 19
    ? many
    : modulo10 === 1
      ? one
      : modulo10 >= 2 && modulo10 <= 4
        ? few
        : many;
  return `${count} ${form}`;
}

