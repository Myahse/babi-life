import {
  Crown,
  Milk, Soup, Bath, NotebookPen, Egg, Beef,
  Banana, Banknote, Car, CloudRain, IdCard, Shield, Umbrella, ZapOff, Beer, Bed, BedDouble, BedSingle, Castle, ChefHat, DoorOpen, Gem, HandCoins, Newspaper, Sofa, Briefcase, Building2, Bus, Camera, Coffee, CookingPot, Disc3, Drumstick, Fish, Sandwich,
  Flame, Footprints, HandHeart, Heart, Hourglass, House, Landmark, MessagesSquare, Moon, Mountain, Music, Palette,
  PartyPopper, PiggyBank, ShoppingBasket, ShowerHead, Smartphone, Sparkles, Store, Sunset, TreePalm, Trophy, Tv, Users,
  Volleyball, Waves, Baby, Bird, BookOpen, BrushCleaning, Cake, CarTaxiFront, Drama, Drum, FileText, Flag, Flower2, Gift, GraduationCap, Hammer,
  Hospital, Library, Presentation, Shovel, Stamp, Stethoscope, Utensils, ShoppingBag, ShoppingCart, Shirt, IceCreamCone, Hamburger, CupSoda, Scissors, Hotel, Hand, Send, Fuel, Bike, Dumbbell, type LucideIcon,
} from 'lucide-react'

// Icon names sent by the API (backend/internal/game) → components.
const REGISTRY: Record<string, LucideIcon> = {
  crown: Crown,
  'milk': Milk, 'soup': Soup, 'bath': Bath, 'notebook-pen': NotebookPen, 'egg': Egg, 'beef': Beef,
  banana: Banana, banknote: Banknote, beer: Beer, bed: Bed, 'bed-double': BedDouble, briefcase: Briefcase,
  'building-2': Building2, bus: Bus, camera: Camera, coffee: Coffee, 'cooking-pot': CookingPot, 'disc-3': Disc3,
  drumstick: Drumstick, sandwich: Sandwich, fish: Fish, flame: Flame, footprints: Footprints, 'hand-heart': HandHeart, heart: Heart,
  hourglass: Hourglass, house: House, landmark: Landmark, 'messages-square': MessagesSquare, moon: Moon,
  mountain: Mountain, music: Music, palette: Palette, 'party-popper': PartyPopper, 'piggy-bank': PiggyBank,
  'shopping-basket': ShoppingBasket, 'shower-head': ShowerHead, smartphone: Smartphone, store: Store, sunset: Sunset,
  'tree-palm': TreePalm, trophy: Trophy, tv: Tv, users: Users, volleyball: Volleyball, waves: Waves,
  'bed-single': BedSingle, castle: Castle, 'chef-hat': ChefHat, 'door-open': DoorOpen, gem: Gem, 'hand-coins': HandCoins,
  newspaper: Newspaper, sofa: Sofa,
  car: Car, 'cloud-rain': CloudRain, 'id-card': IdCard, shield: Shield, umbrella: Umbrella, 'zap-off': ZapOff,
  baby: Baby, bird: Bird, 'book-open': BookOpen, 'brush-cleaning': BrushCleaning, cake: Cake, 'car-taxi-front': CarTaxiFront,
  drama: Drama, drum: Drum, 'file-text': FileText, flag: Flag, 'flower-2': Flower2, gift: Gift, 'graduation-cap': GraduationCap,
  hammer: Hammer, hospital: Hospital, library: Library, presentation: Presentation, shovel: Shovel, sparkles: Sparkles,
  stamp: Stamp, stethoscope: Stethoscope, utensils: Utensils, 'shopping-bag': ShoppingBag, 'shopping-cart': ShoppingCart, shirt: Shirt,
  'ice-cream-cone': IceCreamCone, hamburger: Hamburger, 'cup-soda': CupSoda,
  scissors: Scissors, hotel: Hotel, hand: Hand, send: Send, fuel: Fuel, bike: Bike, dumbbell: Dumbbell,
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
  stade: ['#ffd8a8', '#e8590c'],
  nature: ['#9be15d', '#2fa84f'],
  happening: ['#ffd54f', '#ffa000'],
  mairie: ['#69e2a0', '#00895a'],
  school: ['#7fd3ff', '#1e88e5'],
  health: ['#ff9aa8', '#e53950'],
  culture: ['#ffb07a', '#d9480f'],
  mall: ['#f8a5c2', '#c2255c'],
  restaurant: ['#ffc078', '#e8590c'],
  barbier: ['#74c0fc', '#1d3557'],
  salon: ['#fcc2d7', '#c2255c'],
  hotel: ['#ffe066', '#c9a227'],
  universite: ['#91a7ff', '#3b5bdb'],
  village: ['#e9c46a', '#a0612b'],
  lagune: ['#66d9e8', '#1971c2'],
  boutique: ['#ffd8a8', '#f08c00'],
  couture: ['#d0bfff', '#7048e8'],
  pharmacie: ['#8ce99a', '#2b8a3e'],
  police: ['#a5d8ff', '#1c4f9c'],
  gym: ['#ffc9c9', '#e03131'],
  station: ['#ff8a65', '#d62828'],
}
export const kindColors = (kind: string) => KIND_COLORS[kind] ?? ['#c3c8dc', '#7a8099']
