import type { ShopPurchase } from './types'
// (By its full path: the i18n scripts find the strings of the files that import lib/i18n.)
import { t } from '../lib/i18n'

// Google Play Billing, for the Android app's shop (play.native.ts, picked by
// React Native over this file). On the website there's none: the shop pays
// through GeniusPay, and nothing here is ever called.

/** What paying through Google Play came to: paid (given), pending (a cash payment: given once Google says), or cancelled. */
export type PlayResult = { status: 'paid' | 'pending'; purchase?: ShopPurchase } | { status: 'cancelled' }

/** Google Play Billing is there (only in the Android app). */
export const playBilling = false

/** Google's prices for these products, in the phone's currency (none here). */
export async function playPrices(_ids: string[]): Promise<Record<string, string>> {
  return {}
}

/** A product bought through Google Play (never on the website). */
export async function payWithPlay(_item: { playId: string; sim: string }): Promise<PlayResult> {
  throw new Error(t('Google Play n’est disponible que dans l’appli Android.'))
}

/** The purchases Google holds and the server hasn't had yet, sent to it (nothing here). */
export async function recoverPlay(_sim?: string): Promise<number> {
  return 0
}

/** Recovery on each sign-in (nothing here); returns how to stop. */
export function startPlayRecovery() {
  return () => undefined
}
