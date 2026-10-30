import { Platform } from 'react-native'
import { ErrorCode, fetchProducts, getAvailablePurchases, initConnection, requestPurchase, type Purchase } from 'expo-iap'
import { api, ApiError } from './api'
import { useSession } from '../store/session'
import type { ShopPurchase } from './types'
// (By its full path: the i18n scripts find the strings of the files that import lib/i18n.)
import { t } from '../lib/i18n'

// Google Play Billing in the Android app (React Native picks this file over
// play.ts): the shop's things are bought through Google Play, as Google wants
// in a Play Store app (never GeniusPay here). The product's ID is the
// server's catalogue's playId; the purchase token goes to the server
// (POST /shop/play), which checks it with Google, gives what was bought once,
// and consumes or acknowledges it there. A cash payment can stay pending: the
// server gives it when Google says it's paid.

export type PlayResult = { status: 'paid' | 'pending'; purchase?: ShopPurchase } | { status: 'cancelled' }

/** Google Play Billing is there (the Android app). */
export const playBilling = Platform.OS === 'android'

let connecting: Promise<unknown> | null = null
const connect = () => {
  connecting ??= initConnection().catch((e) => {
    connecting = null
    throw e
  })
  return connecting
}

/** Google's prices for these products, as the phone shows them (« 1 000 F CFA », « 1,99 € »); those it hasn't, left out. */
export async function playPrices(ids: string[]): Promise<Record<string, string>> {
  if (!playBilling || !ids.length) return {}
  await connect()
  const products = (await fetchProducts({ skus: ids, type: 'in-app' })) ?? []
  const prices: Record<string, string> = {}
  for (const p of products) if (p.displayPrice) prices[p.id] = p.displayPrice
  return prices
}

const codeOf = (e: unknown) => (e as { code?: string } | null)?.code
/** What a failure of Google Play's says to the player. */
function failure(e: unknown) {
  if (e instanceof ApiError) return e
  switch (codeOf(e)) {
    case ErrorCode.NetworkError:
    case ErrorCode.ServiceTimeout:
    case ErrorCode.ServiceDisconnected:
      return new Error(t('Pas de réseau pour Google Play : réessaie dans un instant.'))
    case ErrorCode.BillingUnavailable:
    case ErrorCode.IapNotAvailable:
    case ErrorCode.InitConnection:
      return new Error(t('Google Play n’est pas disponible sur ce téléphone (mets à jour le Play Store, ou connecte un compte Google).'))
    case ErrorCode.SkuNotFound:
    case ErrorCode.ItemUnavailable:
      return new Error(t('Cet article n’est pas encore en vente sur Google Play.'))
  }
  return new Error(t('Google Play a refusé le paiement : réessaie dans un instant.'))
}

/** One purchase Google holds, sent to the server (checked there with Google, given once). */
const send = (p: Purchase, sim?: string) => api.play({ productId: p.productId, purchaseToken: p.purchaseToken!, ...(sim ? { sim } : {}) })

/** The purchases Google holds (unfinished: not given, or not consumed yet), each sent to the server; how many it gave. */
export async function recoverPlay(sim?: string): Promise<number> {
  if (!playBilling || !useSession.getState().token) return 0
  await connect()
  const held = await getAvailablePurchases()
  let given = 0
  for (const p of held) {
    if (!p.purchaseToken) continue
    try {
      if ((await send(p, sim)).credited) given++
    } catch {
      // (The server shut, or Google not answering: sent again next time.)
    }
  }
  return given
}

/** A product bought through Google Play, for this Sim: paid (given), pending, or cancelled; a failure throws, said in French. */
export async function payWithPlay(item: { playId: string; sim: string }): Promise<PlayResult> {
  try {
    await connect()
  } catch (e) {
    throw failure(e)
  }
  // Our account's ID with the purchase: the server gives it to this account only (and to it when Google alone tells it).
  const account = useSession.getState().user?.id
  let bought: Purchase[]
  try {
    const r = await requestPurchase({ request: { google: { skus: [item.playId], ...(account ? { obfuscatedAccountId: account } : {}) } }, type: 'in-app' })
    bought = r == null ? [] : Array.isArray(r) ? r : [r]
  } catch (e) {
    const code = codeOf(e)
    if (code === ErrorCode.UserCancelled) return { status: 'cancelled' }
    if (code === ErrorCode.Pending || code === ErrorCode.DeferredPayment) return { status: 'pending' }
    // Bought before and not given yet (the app closed on the way): Google's held purchase, sent now.
    if (code === ErrorCode.AlreadyOwned) {
      const held = (await getAvailablePurchases().catch(() => [] as Purchase[])).find((p) => p.productId === item.playId && p.purchaseToken)
      if (!held) throw new Error(t('Tu as déjà cet article.'))
      bought = [held]
    } else throw failure(e)
  }
  const p = bought.find((x) => x.productId === item.playId && x.purchaseToken)
  if (!p) return { status: 'cancelled' }
  try {
    const purchase = await send(p, item.sim)
    return { status: purchase.credited ? 'paid' : 'pending', purchase }
  } catch (e) {
    // Google took it: the server gives it when it can (sent again at the next opening, or Google's notification).
    if (p.purchaseState === 'pending') return { status: 'pending' }
    throw failure(e)
  }
}

/** The purchases left over (the app closed during a payment), sent to the server at each sign-in; returns how to stop. */
export function startPlayRecovery() {
  if (!playBilling) return () => undefined
  let done: string | null = null
  const run = (token: string | null) => {
    if (!token || token === done) return
    done = token
    void recoverPlay().catch(() => undefined)
  }
  run(useSession.getState().token)
  return useSession.subscribe((s) => run(s.token))
}
