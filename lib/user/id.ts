export function parseDatabaseUserId(id: string): number | null {
  if (!/^[1-9]\d*$/.test(id)) {
    return null;
  }

  const numericId = Number(id);
  return Number.isSafeInteger(numericId) ? numericId : null;
}

export function toDatabaseUserId(id: string): number {
  const numericId = parseDatabaseUserId(id);
  if (numericId === null) {
    throw new Error("User ID must be a positive integer.");
  }

  return numericId;
}
