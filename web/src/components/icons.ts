import {
  Banana, Banknote, Beer, Bed, BedDouble, Briefcase, Building2, Bus, Camera, Coffee, CookingPot, Disc3, Drumstick, Fish,
  Flame, Footprints, HandHeart, Heart, Hourglass, House, Landmark, MessagesSquare, Moon, Mountain, Music, Palette,
  PartyPopper, PiggyBank, ShoppingBasket, ShowerHead, Smartphone, Sparkles, Store, Sunset, TreePalm, Trophy, Tv, Users,
  Volleyball, Waves, type LucideIcon,
} from 'lucide-react'

// Icon names sent by the API (backend/internal/game) → components.
const REGISTRY: Record<string, LucideIcon> = {
  banana: Banana, banknote: Banknote, beer: Beer, bed: Bed, 'bed-double': BedDouble, briefcase: Briefcase,
  'building-2': Building2, bus: Bus, camera: Camera, coffee: Coffee, 'cooking-pot': CookingPot, 'disc-3': Disc3,
  drumstick: Drumstick, fish: Fish, flame: Flame, footprints: Footprints, 'hand-heart': HandHeart, heart: Heart,
  hourglass: Hourglass, house: House, landmark: Landmark, 'messages-square': MessagesSquare, moon: Moon,
  mountain: Mountain, music: Music, palette: Palette, 'party-popper': PartyPopper, 'piggy-bank': PiggyBank,
  'shopping-basket': ShoppingBasket, 'shower-head': ShowerHead, smartphone: Smartphone, store: Store, sunset: Sunset,
  'tree-palm': TreePalm, trophy: Trophy, tv: Tv, users: Users, volleyball: Volleyball, waves: Waves,
}

export const iconFor = (name: string): LucideIcon => REGISTRY[name] ?? Sparkles

// Each kind of place gets its own colour so the map reads at a glance.
export const KIND_COLORS: Record<string, [string, string]> = {
  home: ['#ffb347', '#ff7a00'],
  maquis: ['#ff8a65', '#ff3d57'],
  market: ['#ffd54f', '#ffa000'],
  office: ['#64b5ff', '#2a6cf0'],
  beach: ['#4dd8e6', '#0097c4'],
  worship: ['#b39dff', '#6c47ff'],
  transport: ['#8c9eff', '#3d4fd6'],
  club: ['#ff7ad9', '#b02bd6'],
  sport: ['#69e2a0', '#00a862'],
  nature: ['#9be15d', '#2fa84f'],
}
export const kindColors = (kind: string) => KIND_COLORS[kind] ?? ['#c3c8dc', '#7a8099']
