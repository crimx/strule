export function isValidUnicodeString(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) as number;

    if (codePoint >= 0xd800 && codePoint <= 0xdfff) {
      return false;
    }

    if (
      (codePoint >= 0xfdd0 && codePoint <= 0xfdef) ||
      (codePoint & 0xffff) === 0xfffe ||
      (codePoint & 0xffff) === 0xffff
    ) {
      return false;
    }
  }

  return true;
}

export function countCodePoints(value: string): number {
  let count = 0;

  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      index += 1;
    }
    count += 1;
  }

  return count;
}
