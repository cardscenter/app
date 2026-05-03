/** 30-dagen cooldown na elke adreswijziging — anti-fraude maatregel zodat
 *  iemand niet snel-snel z'n adres kan veranderen om bv. een dispute te
 *  ontwijken of meerdere accounts te koppelen. Eerste keer is gratis (null
 *  lastAddressChange). */
export const ADDRESS_COOLDOWN_DAYS = 30;

export interface AddressCooldownInfo {
  /** Mag de gebruiker nu zijn adres wijzigen? */
  canEdit: boolean;
  /** Aantal dagen tot eerstvolgende edit — 0 als canEdit. */
  daysRemaining: number;
  /** Datum waarop de cooldown afloopt — null als canEdit. */
  availableAt: Date | null;
}

export function getAddressCooldownInfo(
  lastAddressChange: Date | string | null,
): AddressCooldownInfo {
  if (!lastAddressChange) {
    return { canEdit: true, daysRemaining: 0, availableAt: null };
  }
  const last =
    lastAddressChange instanceof Date ? lastAddressChange : new Date(lastAddressChange);
  const cooldownMs = ADDRESS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  const availableAt = new Date(last.getTime() + cooldownMs);
  const now = Date.now();
  if (availableAt.getTime() <= now) {
    return { canEdit: true, daysRemaining: 0, availableAt: null };
  }
  const daysRemaining = Math.ceil((availableAt.getTime() - now) / (1000 * 60 * 60 * 24));
  return { canEdit: false, daysRemaining, availableAt };
}
