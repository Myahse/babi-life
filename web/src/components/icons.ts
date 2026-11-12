import {
  CircleDot,
  Crown,
  Milk, Soup, Bath, NotebookPen, Egg, Beef,
  Banana, Banknote, Martini, KeyRound, Car, CloudRain, IdCard, Shield, Umbrella, ZapOff, Beer, Bed, BedDouble, BedSingle, Castle, ChefHat, Church, DoorOpen, Gem, HandCoins, Newspaper, Sofa, Briefcase, Building2, Bus, Camera, Coffee, CookingPot, Disc3, Drumstick, Fish, Sandwich, Ticket,
  Flame, Footprints, HandHeart, Heart, Hourglass, House, LandPlot, Landmark, MessagesSquare, Moon, Mountain, Music, Palette,
  PartyPopper, PiggyBank, ShoppingBasket, ShowerHead, Smartphone, Sparkles, Store, Sunset, TreePalm, Trophy, Tv, Users,
  Volleyball, Waves, Baby, Bird, BookOpen, BrushCleaning, Cake, CarTaxiFront, Drama, Drum, FileText, Flag, Flower2, Gift, GraduationCap, Hammer,
  Hospital, Library, Presentation, Shovel, Stamp, Stethoscope, Utensils, ShoppingBag, ShoppingCart, Shirt, IceCreamCone, Hamburger, CupSoda, Scissors, Hotel, Hand, Send, Fuel, Bike, Dumbbell, PawPrint, UserPlus, Snowflake, Clapperboard, Popcorn, Plane, TrainFront, Dice5, Blocks, Toilet, Toothbrush, Sailboat, HardHat, Citrus, Croissant, Droplet, Grid3x3, type LucideIcon,
  Gamepad2, Joystick, Swords, Eye, Binoculars, Target, Trees, Siren, Package, CreditCard, HeartHandshake, Cherry, Speaker, LifeBuoy, Ship,
  Frown, Annoyed, Droplets, Sprout, LampFloor, Piano, GlassWater, Apple, Refrigerator, Archive, Fan, Armchair, RectangleHorizontal, ChevronsUp,
  Mail, PenLine, Receipt, Megaphone, Coins, HeartPulse, Syringe, ScanLine, Calculator, ConciergeBell, Luggage, Handshake, Gavel, Pill, ClipboardList,
  Brain, BatteryLow, UtensilsCrossed, UserX, Meh, Trash2, Smile, Laugh, HeartCrack, Star, RefreshCw, ListPlus,
  Clock, X, EyeOff, Search, Eraser, CircleHelp, FilePenLine, Dices, Wrench, Zap, School, Phone, Signpost,
} from 'lucide-react'

// Icon names sent by the API (backend/internal/game) → components.
const REGISTRY: Record<string, LucideIcon> = {
  snowflake: Snowflake, clapperboard: Clapperboard, popcorn: Popcorn, plane: Plane, 'train-front': TrainFront, 'dice-5': Dice5, 'circle-dot': CircleDot, blocks: Blocks, sailboat: Sailboat, cherry: Cherry,
  crown: Crown, speaker: Speaker,
  // Yamoussoukro and Bouaké (backend game/villes.go): the safari, the golf.
  binoculars: Binoculars, target: Target,
  // San-Pédro and Korhogo (backend game/villes2.go): the sacred wood.
  trees: Trees,
  // The carrefours (backend game/quartiers.go).
  signpost: Signpost,
  // The banks and the robberies (backend game/braquage.go).
  siren: Siren, package: Package, 'credit-card': CreditCard,
  toilet: Toilet, toothbrush: Toothbrush,
  'milk': Milk, 'soup': Soup, 'bath': Bath, 'notebook-pen': NotebookPen, 'egg': Egg, 'beef': Beef,
  banana: Banana, banknote: Banknote, beer: Beer, bed: Bed, 'bed-double': BedDouble, briefcase: Briefcase,
  church: Church, 'building-2': Building2, bus: Bus, camera: Camera, coffee: Coffee, 'cooking-pot': CookingPot, 'disc-3': Disc3,
  drumstick: Drumstick, sandwich: Sandwich, ticket: Ticket, fish: Fish, flame: Flame, footprints: Footprints, 'hand-heart': HandHeart, heart: Heart,
  hourglass: Hourglass, house: House, 'land-plot': LandPlot, landmark: Landmark, 'messages-square': MessagesSquare, moon: Moon,
  mountain: Mountain, music: Music, palette: Palette, 'party-popper': PartyPopper, 'piggy-bank': PiggyBank,
  'shopping-basket': ShoppingBasket, 'shower-head': ShowerHead, smartphone: Smartphone, store: Store, sunset: Sunset,
  martini: Martini, 'key-round': KeyRound,
  'tree-palm': TreePalm, trophy: Trophy, tv: Tv, users: Users, 'user-plus': UserPlus, volleyball: Volleyball, waves: Waves, 'life-buoy': LifeBuoy, ship: Ship,
  'bed-single': BedSingle, castle: Castle, 'chef-hat': ChefHat, 'door-open': DoorOpen, gem: Gem, 'hand-coins': HandCoins,
  newspaper: Newspaper, sofa: Sofa,
  car: Car, 'cloud-rain': CloudRain, 'id-card': IdCard, shield: Shield, umbrella: Umbrella, 'zap-off': ZapOff,
  baby: Baby, bird: Bird, 'book-open': BookOpen, 'brush-cleaning': BrushCleaning, cake: Cake, 'car-taxi-front': CarTaxiFront,
  drama: Drama, drum: Drum, 'file-text': FileText, flag: Flag, 'flower-2': Flower2, gift: Gift, 'graduation-cap': GraduationCap,
  hammer: Hammer, hospital: Hospital, library: Library, presentation: Presentation, shovel: Shovel, sparkles: Sparkles,
  stamp: Stamp, stethoscope: Stethoscope, utensils: Utensils, 'shopping-bag': ShoppingBag, 'shopping-cart': ShoppingCart, shirt: Shirt,
  'ice-cream-cone': IceCreamCone, hamburger: Hamburger, 'cup-soda': CupSoda,
  scissors: Scissors, hotel: Hotel, hand: Hand, send: Send, fuel: Fuel, bike: Bike, dumbbell: Dumbbell, 'paw-print': PawPrint, 'hard-hat': HardHat,
  citrus: Citrus, croissant: Croissant, droplet: Droplet, 'grid-3x3': Grid3x3,
  // The house's furniture (backend game/house.go) and the fridge's things (game/fridge.go).
  frown: Frown, annoyed: Annoyed, droplets: Droplets, sprout: Sprout, 'lamp-floor': LampFloor, piano: Piano, 'glass-water': GlassWater, apple: Apple, refrigerator: Refrigerator, archive: Archive, fan: Fan, armchair: Armchair, 'rectangle-horizontal': RectangleHorizontal, 'chevrons-up': ChevronsUp,
  // The salle de jeux vidéo.
  'gamepad-2': Gamepad2, joystick: Joystick, 'heart-handshake': HeartHandshake, swords: Swords, eye: Eye,
  // At work (backend game/jobs.go).
  mail: Mail, 'pen-line': PenLine, receipt: Receipt, megaphone: Megaphone, coins: Coins, 'heart-pulse': HeartPulse, syringe: Syringe, 'scan-line': ScanLine,
  calculator: Calculator, 'concierge-bell': ConciergeBell, luggage: Luggage, handshake: Handshake, gavel: Gavel, pill: Pill, 'clipboard-list': ClipboardList,
  // Le mode vie's moods and skills (backend game/vie.go).
  brain: Brain, 'battery-low': BatteryLow, 'utensils-crossed': UtensilsCrossed, 'user-x': UserX, meh: Meh, 'trash-2': Trash2, smile: Smile, laugh: Laugh, 'heart-crack': HeartCrack, star: Star, 'refresh-cw': RefreshCw, 'list-plus': ListPlus,
  // Le mode vie's work day and the house's broken things (backend game/boulot.go, game/objets.go).
  clock: Clock, x: X, 'eye-off': EyeOff, search: Search, eraser: Eraser, 'circle-help': CircleHelp, 'file-pen-line': FilePenLine, dices: Dices, wrench: Wrench, zap: Zap, school: School, phone: Phone,
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
  aeroport: ['#74c0fc', '#1d4ed8'],
  club: ['#ff7ad9', '#b02bd6'],
  sport: ['#69e2a0', '#00a862'],
  stade: ['#ffd8a8', '#e8590c'],
  nature: ['#9be15d', '#2fa84f'],
  happening: ['#ffd54f', '#ffa000'],
  mairie: ['#69e2a0', '#00895a'],
  tribunal: ['#c9b8ff', '#5b3fd6'],
  assemblee: ['#ffb37a', '#d9480f'],
  soiree: ['#ff5cc8', '#7a2bd6'],
  presidence: ['#ffd36e', '#b8860b'],
  school: ['#7fd3ff', '#1e88e5'],
  health: ['#ff9aa8', '#e53950'],
  culture: ['#ffb07a', '#d9480f'],
  cinema: ['#ff8787', '#c92a2a'],
  mall: ['#f8a5c2', '#c2255c'],
  restaurant: ['#ffc078', '#e8590c'],
  barbier: ['#74c0fc', '#1d3557'],
  salon: ['#fcc2d7', '#c2255c'],
  hotel: ['#ffe066', '#c9a227'],
  universite: ['#91a7ff', '#3b5bdb'],
  village: ['#e9c46a', '#a0612b'],
  lagune: ['#66d9e8', '#1971c2'],
  boutique: ['#ffd8a8', '#f08c00'],
  gaming: ['#b197fc', '#5f3dc4'],
  orphelinat: ['#ffc9de', '#e64980'],
  couture: ['#d0bfff', '#7048e8'],
  pharmacie: ['#8ce99a', '#2b8a3e'],
  police: ['#a5d8ff', '#1c4f9c'],
  gym: ['#ffc9c9', '#e03131'],
  station: ['#ff8a65', '#d62828'],
  zoo: ['#c0eb75', '#5c940d'],
  chantier: ['#ffd43b', '#f08c00'],
  karting: ['#ffb36b', '#e8432f'],
  banque: ['#96f2d7', '#087f5b'],
  prison: ['#ced4da', '#343a40'],
  rue: ['#ffb36b', '#f77f00'],
  // San-Pédro and Korhogo (backend game/villes2.go): the fishing port, the craft villages, the sacred wood, the excursions.
  peche: ['#74c0fc', '#1864ab'],
  artisans: ['#ffc078', '#a0522d'],
  sacre: ['#8ce99a', '#2b8a3e'],
  excursion: ['#a9e34b', '#5c940d'],
  // Man and Daloa (backend game/villes3.go): the plantations, the river.
  plantation: ['#d8f5a2', '#5c940d'],
  riviere: ['#99e9f2', '#0b7285'],
  // The communes in detail (backend game/quartiers.go): the carrefours' green road sign, the préfectures' blue.
  carrefour: ['#51cf66', '#0b5f36'],
  prefecture: ['#74c0fc', '#1c4f9c'],
}
export const kindColors = (kind: string) => KIND_COLORS[kind] ?? ['#c3c8dc', '#7a8099']
