import type { CarteDish as Dish, Interaction, World } from '../lib/types'
import { discounted } from '../lib/civic'

// La cuisine ivoirienne (backend game/cuisine.go, the update « cuisine-ivoire »): the same rules as the
// server's, to show each place's carte as it is: the rare dishes only at some places, the dish of the
// day for less.

export const CUISINE_KEY = 'cuisine-ivoire'
export const DISH_PREFIX = 'plat-'
export const RECIPE_PREFIX = 'recette-'
export const isDish = (id: string) => id.startsWith(DISH_PREFIX)
export const isRecipe = (id: string) => id.startsWith(RECIPE_PREFIX)

const enc = new TextEncoder()
/** FNV-1a over the strings joined by « | » (game.hash32). */
export function hash32(...parts: string[]) {
  let h = 0x811c9dc5
  parts.forEach((p, i) => {
    const bytes = enc.encode(i ? `|${p}` : p)
    for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0
  })
  return h >>> 0
}

const dishOf = (world: World, id: string) => world.cuisine?.dishes.find((d) => d.id === id)

/** This place has this dish on its carte (game.Serves). */
export function serves(world: World, placeId: string, id: string) {
  const d = dishOf(world, id)
  return !!d && (!d.rare || hash32(placeId, id) % 2 === 0)
}

/** The place's dish of the day (game.DishOfDay), or ''. */
export function dishOfDay(world: World, placeId: string, kind: string, city: string, gameMinutes: number) {
  const plats = (world.cuisine?.dishes ?? []).filter((d) => (d.section === 'plats' || d.section === 'grillades') && d.kinds.includes(kind) && (!d.cities?.length || d.cities.includes(city)) && serves(world, placeId, d.id))
  if (!plats.length) return ''
  const day = Math.floor(gameMinutes / 1440)
  return plats[hash32(placeId, String(day)) % plats.length].id
}

/** The dish as this place serves it (null: not on its carte): the dish of the day for less. */
export function onCarte(world: World, it: Interaction, placeId: string, kind: string, city: string, gameMinutes: number): Interaction | null {
  if (!isDish(it.id)) return it
  if (!serves(world, placeId, it.id)) return null
  if (dishOfDay(world, placeId, kind, city, gameMinutes) === it.id) return { ...it, cost: discounted(it.cost, world.cuisine?.dayOff ?? 0) }
  return it
}

/** A dish's carte entry by its activity's id. */
export const findDish = (world: World, id: string): Dish | undefined => dishOf(world, id)

/** An ingredient's price at this market (Adjamé and Treichville for less). */
export function ingredientPrice(world: World, price: number, placeId?: string) {
  const c = world.cuisine
  return c && placeId && c.bigMarkets.includes(placeId) ? discounted(price, c.bigMarketOff) : price
}
