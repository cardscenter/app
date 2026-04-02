/**
 * Generate a unique order number in format: ORD-YYYYMMDD-XXXX
 * Example: ORD-20260402-4827
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `ORD-${date}-${rand}`;
}
