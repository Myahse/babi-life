import { useEffect, useState } from 'react'
import { Award, BadgeCheck, Baby, GraduationCap, Shield, Briefcase, Car, ChevronLeft, ChevronRight, FileText, Heart, House, IdCard, KeyRound, LandPlot, MapPin, Send, ShieldAlert, Stamp, type LucideIcon } from 'lucide-react'
import { api, ApiError, type Paper, type PaperKind } from '../lib/api'
import type { Look, Sim } from '../lib/types'
import { Portrait } from '../avatar/portrait'
import { EPOCH, fcfa } from '../game/rules'
import { useShare } from '../lib/share'
import { IconTile } from './ui'
import { locale, t as tr } from '../lib/i18n'

/**
 * Les papiers (update « papiers », backend sims/papiers.go): the phone's « Papiers » wallet, each of the
 * Sim's documents drawn as a card of the game's own (the « Babi Life » band, « Document de jeu — sans
 * valeur », invented colours and layouts, the numbers in the game's format: never a real document's
 * design, emblem or stamp). The photo is the Sim's 3D portrait. « Montrer » sends it in a chat as a card
 * (components/SharedCard.tsx), the way a bet ticket is shared.
 */

type Kind = { title: string; icon: LucideIcon; colors: [string, string] }
export const PAPER_KINDS: Record<PaperKind, Kind> = {
  'carte-identite': { title: tr('Carte d’identité'), icon: IdCard, colors: ['#ff9a3c', '#00a37a'] },
  'extrait-naissance': { title: tr('Extrait d’acte de naissance'), icon: Baby, colors: ['#7fd6a8', '#2f9e6b'] },
  'permis-conduire': { title: tr('Permis de conduire'), icon: KeyRound, colors: ['#ff8fb1', '#d6336c'] },
  'carte-grise': { title: tr('Carte grise'), icon: Car, colors: ['#a5b4cb', '#4c5d7a'] },
  'acte-mariage': { title: tr('Acte de mariage'), icon: Heart, colors: ['#ffa8c5', '#e64980'] },
  'livret-famille': { title: tr('Livret de famille'), icon: House, colors: ['#69db7c', '#2b8a3e'] },
  'contrat-travail': { title: tr('Contrat de travail'), icon: Briefcase, colors: ['#ffc56b', '#e8590c'] },
  'contrat-bail': { title: tr('Contrat de bail'), icon: FileText, colors: ['#8ec5ff', '#1c7ed6'] },
  'titre-propriete': { title: tr('Titre de propriété'), icon: LandPlot, colors: ['#ffd43b', '#b07d00'] },
  'diplome-bepc': { title: tr('Diplôme du BEPC'), icon: Award, colors: ['#b197fc', '#6741d9'] },
  'diplome-bac': { title: tr('Diplôme du baccalauréat'), icon: Award, colors: ['#9775fa', '#5f3dc4'] },
  'attestation-legalisation': { title: tr('Attestation de légalisation'), icon: Stamp, colors: ['#74c0fc', '#1864ab'] },
  'avis-controle': { title: tr('Avertissement de contrôle'), icon: ShieldAlert, colors: ['#ff8787', '#c92a2a'] },
  'attestation-service': { title: tr('Attestation de service militaire'), icon: Shield, colors: ['#a9b97c', '#4f5b36'] },
  'brevet-empt': { title: tr('Brevet de l’EMPT'), icon: GraduationCap, colors: ['#8fbf8a', '#2f5d3a'] },
}

const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')
const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0)
/** A game minute as a date (the game's clock is Abidjan's, UTC). */
const gameDate = (m: unknown) => new Date(EPOCH + num(m) * 60000).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const realDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '')
/**
 * The birth day on an identity paper: its day and month in game time, its year so many years before the
 * paper was made as the Sim was old that day (a game year lasts hours of play: the real date would be days ago).
 */
function birthDate(p: Paper) {
  const born = new Date(EPOCH + num(p.data.born) * 60000)
  if (typeof p.data.years !== 'number') return gameDate(p.data.born)
  const year = new Date(p.issuedAt).getUTCFullYear() - p.data.years
  return new Date(Date.UTC(year, born.getUTCMonth(), born.getUTCDate())).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
/** The army's papers' mention (backend game.Mention), said in the player's language. */
const mention = (m: unknown) => ({ 'Très bien': tr('Très bien'), Bien: tr('Bien'), 'Assez bien': tr('Assez bien'), Passable: tr('Passable') })[str(m)] ?? str(m)
const sex = (g: unknown) => (g === 'homme' ? tr('M') : tr('F'))

/** What a document says, line by line. */
function fields(p: Paper): [string, string][] {
  const d = p.data
  const name: [string, string][] = [
    [tr('Nom'), str(d.lastName).toUpperCase()],
    [tr('Prénom(s)'), str(d.firstName)],
  ]
  switch (p.kind) {
    case 'extrait-naissance':
      return [...name, [tr('Sexe'), sex(d.gender)], [tr('Né·e le'), birthDate(p)], [tr('À'), str(d.commune)], [tr('Père'), str(d.father)], [tr('Mère'), str(d.mother)], ...(d.family ? [[tr('Famille'), str(d.family)] as [string, string]] : [])]
    case 'carte-identite':
      return [...name, [tr('Sexe'), sex(d.gender)], [tr('Né·e le'), birthDate(p)], [tr('Domicile'), str(d.commune)]]
    case 'permis-conduire':
      return [...name, [tr('Né·e le'), birthDate(p)], [tr('Catégories'), str(d.classes)], [tr('Domicile'), str(d.commune)]]
    case 'carte-grise':
      return [
        [tr('Immatriculation'), str(d.plate)],
        [tr('Titulaire'), str(d.holder)],
        [tr('Véhicule'), str(d.model)],
        [tr('Genre'), d.vehicle === 'moto' ? tr('Moto') : tr('Voiture')],
        [tr('Couleur'), str(d.color)],
        [tr('1re mise en circulation'), gameDate(d.bought)],
      ]
    case 'acte-mariage':
      return [
        [tr('Époux·se'), str(d.holder)],
        [tr('Et'), str(d.spouse)],
        [tr('Célébré le'), gameDate(d.on)],
        [tr('À'), str(d.place) || str(d.commune)],
      ]
    case 'livret-famille': {
      const kids = Array.isArray(d.kids) ? (d.kids as { name: string; born: number }[]) : []
      return [
        [tr('Titulaire'), str(d.holder)],
        ...(d.spouse ? [[tr('Conjoint·e'), str(d.spouse)] as [string, string]] : []),
        ...kids.map((k, i) => [tr('Enfant {0}', { 0: i + 1 }), `${k.name} · ${gameDate(k.born)}`] as [string, string]),
        ...(kids.length === 0 ? [[tr('Enfants'), tr('aucun pour l’instant')] as [string, string]] : []),
      ]
    }
    case 'contrat-travail':
      return [
        [tr('Employeur'), str(d.employer)],
        [tr('Salarié·e'), str(d.holder)],
        [tr('Poste'), str(d.title)],
        [tr('Métier'), str(d.career)],
        [tr('Salaire'), tr('{0} par service', { 0: fcfa(num(d.pay)) })],
        [tr('Lieu'), str(d.commune)],
      ]
    case 'contrat-bail':
      return [
        [tr('Bailleur'), str(d.landlord)],
        [tr('Locataire'), str(d.holder)],
        [tr('Logement'), str(d.housing)],
        [tr('Loyer'), tr('{0} par semaine', { 0: fcfa(num(d.rent)) })],
        [tr('Commune'), str(d.commune)],
      ]
    case 'titre-propriete':
      return [
        [tr('Propriétaire'), str(d.holder)],
        [tr('Terrain'), tr('{w} × {d} m ({area} m²)', { w: num(d.w), d: num(d.d), area: num(d.area) })],
        [tr('Commune'), str(d.commune)],
        [tr('Prix payé'), fcfa(num(d.paid))],
        [tr('Bâti'), d.built ? tr('oui') : tr('pas encore')],
      ]
    case 'diplome-bepc':
    case 'diplome-bac':
      return [...name, [tr('Né·e le'), birthDate(p)], [tr('Moyenne'), tr('{0}/20', { 0: num(d.marks) })], [tr('Session'), String(new Date(p.issuedAt).getUTCFullYear() - (typeof d.years === 'number' && p.kind === 'diplome-bepc' ? Math.max(0, d.years - 15) : 0))], [tr('Commune'), str(d.commune)]]
    case 'attestation-legalisation': {
      const docs = Array.isArray(d.docs) ? (d.docs as { kind: PaperKind; number: string }[]) : []
      return [[tr('Titulaire'), str(d.holder)], [tr('Lieu'), str(d.place)], ...docs.map((x) => [PAPER_KINDS[x.kind]?.title ?? x.kind, x.number] as [string, string])]
    }
    case 'attestation-service':
      return [...name, [tr('Né·e le'), birthDate(p)], [tr('Unité'), str(d.unit)], [tr('Lieu'), str(d.place)], [tr('Du'), gameDate(d.since)], [tr('Au'), gameDate(d.on)], [tr('Durée'), tr('{0} semaines de classes', { 0: num(d.rounds) })], [tr('Mention'), mention(d.mention)]]
    case 'brevet-empt':
      return [...name, [tr('Né·e le'), birthDate(p)], [tr('École'), str(d.place)], [tr('Promotion'), String(new Date(p.issuedAt).getUTCFullYear())], [tr('Mention'), mention(d.mention)]]
    case 'avis-controle': {
      const missing = Array.isArray(d.missing) ? (d.missing as string[]) : []
      return [
        [tr('Titulaire'), str(d.holder)],
        [tr('Contrôlé·e à'), str(d.commune)],
        [tr('Manquait'), missing.join(', ')],
        [tr('À faire'), tr('se mettre en règle sous 7 jours')],
      ]
    }
  }
}

/** Valid, expired, ended: what the wallet says under it. */
function status(p: Paper): { label: string; tone: 'ok' | 'warn' | 'off' } {
  if (p.ended) return { label: tr('Terminé'), tone: 'off' }
  if (p.expiresAt && new Date(p.expiresAt).getTime() < Date.now()) return { label: tr('Expiré·e : à renouveler'), tone: 'warn' }
  if (p.expiresAt) return { label: tr('Valable jusqu’au {0}', { 0: realDate(p.expiresAt) }), tone: 'ok' }
  return { label: tr('Délivré le {0}', { 0: realDate(p.issuedAt) }), tone: 'ok' }
}

/** One document as a card: the game's band, its lines, the photo when it has one. `compact`: the chat's smaller one. */
export function PaperCard({ paper, gender, compact = false }: { paper: Paper; gender?: Sim['gender']; compact?: boolean }) {
  const k = PAPER_KINDS[paper.kind] ?? PAPER_KINDS['extrait-naissance']
  const look = paper.data.look as Look | undefined
  const g = (gender ?? (paper.data.gender as Sim['gender'] | undefined)) || 'femme'
  const st = status(paper)
  const lines = fields(paper)
  const shown = compact ? lines.slice(0, 4) : lines
  return (
    <div className={`overflow-hidden rounded-2xl bg-[#fffdf7] text-[var(--color-ink)] shadow-[0_6px_18px_-8px_rgba(15,18,48,0.45)] ${paper.ended ? 'opacity-70 grayscale-[0.4]' : ''}`} data-paper={paper.kind}>
      <div className="flex items-center gap-2 px-3 py-2 text-white" style={{ background: `linear-gradient(120deg, ${k.colors[0]}, ${k.colors[1]})` }}>
        <IconTile icon={k.icon} colors={['#ffffff40', '#ffffff22']} size={compact ? 30 : 36} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[10px] font-extrabold tracking-[0.18em] uppercase opacity-90">Babi Life</div>
          <div className={`truncate font-display font-extrabold ${compact ? 'text-[14px]' : 'text-[17px]'}`}>{k.title}</div>
        </div>
      </div>
      <div className="bg-[repeating-linear-gradient(90deg,#16161c0d_0_6px,transparent_6px_12px)] px-3 py-1 text-center text-[10px] font-extrabold tracking-wide text-[#8a5a00] uppercase">{tr('Document de jeu — sans valeur')}</div>
      <div className={`flex gap-3 px-3 ${compact ? 'pt-2 pb-2' : 'pt-3 pb-3'}`}>
        {look && (
          <div className={`shrink-0 overflow-hidden rounded-xl border-2 bg-[#e9f6ff] ${compact ? 'h-[64px] w-[52px]' : 'h-[104px] w-[84px]'}`} style={{ borderColor: k.colors[1] }}>
            <Portrait look={look} gender={g} framing="bust" alt={tr('Photo')} />
          </div>
        )}
        <dl className={`min-w-0 flex-1 ${compact ? 'space-y-0.5' : 'space-y-1'}`}>
          {shown.map(([label, value], i) => (
            <div key={i} className="flex items-baseline gap-2 leading-tight">
              <dt className={`shrink-0 font-bold text-[var(--color-ink-soft)] ${compact ? 'w-[64px] text-[10px]' : 'w-[96px] text-[11.5px]'}`}>{label}</dt>
              <dd className={`min-w-0 flex-1 font-extrabold break-words ${compact ? 'text-[11.5px]' : 'text-[13px]'}`}>
                {paper.kind === 'carte-grise' && label === tr('Couleur') ? <span className="inline-block h-3 w-6 rounded border border-black/20 align-middle" style={{ background: value }} /> : value || '—'}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-dashed border-[#16161c22] px-3 py-2 text-[11px] font-extrabold">
        <span className="tabular-nums tracking-wide">{tr('N° {0}', { 0: paper.number })}</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 ${st.tone === 'ok' ? 'bg-[#e6fcf0] text-[#0b7a4b]' : st.tone === 'warn' ? 'bg-[#fff0e0] text-[#c25400]' : 'bg-[#eef0f4] text-[#5b6178]'}`}>{st.label}</span>
        {paper.legalised && (
          <span className="inline-flex items-center gap-1 rounded-full border-2 border-[#1864ab] px-2 py-0.5 text-[10px] tracking-wide text-[#1864ab] uppercase">
            <BadgeCheck size={12} /> {tr('Copie légalisée')}
          </span>
        )}
      </div>
    </div>
  )
}

/** What's still to get, and where: shown under the wallet. */
function toGet(have: Set<PaperKind>, minor: boolean): { kind: PaperKind; how: string; place?: 'mairie' | 'police' }[] {
  if (minor) return [{ kind: 'carte-identite', how: tr('À 18 ans : à la mairie de ta commune ou au commissariat.') }]
  const out: { kind: PaperKind; how: string; place?: 'mairie' | 'police' }[] = []
  if (!have.has('carte-identite')) out.push({ kind: 'carte-identite', how: tr('À la mairie de ta commune ou au commissariat · {0} · 1 h. Il la faut au contrôle de police, pour certains métiers et pour acheter un terrain.', { 0: fcfa(2000) }), place: 'mairie' })
  if (!have.has('permis-conduire')) out.push({ kind: 'permis-conduire', how: tr('L’examen du code au commissariat · {0} (avec ta carte d’identité). Il le faut au contrôle si tu as une moto ou une voiture.', { 0: fcfa(25000) }), place: 'police' })
  if (!have.has('acte-mariage')) out.push({ kind: 'acte-mariage', how: tr('À la mairie, avec ta moitié · {0} (avec ta carte d’identité).', { 0: fcfa(5000) }), place: 'mairie' })
  out.push({ kind: 'attestation-legalisation', how: tr('Fais légaliser tes papiers à la mairie (« Faire légaliser un document ») · {0}.', { 0: fcfa(500) }), place: 'mairie' })
  return out
}

/** The phone's « Papiers » app. */
export function PapiersApp({ sim, minor, onGo }: { sim: Sim; minor: boolean; /** « Y aller »: to the nearest place of that kind. */ onGo?: (kind: 'mairie' | 'police') => void }) {
  const [papers, setPapers] = useState<Paper[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Paper | null>(null)
  const [busy, setBusy] = useState(false)
  const share = useShare((s) => s.share)
  useEffect(() => {
    let live = true
    api
      .papers(sim.id)
      .then((r) => live && setPapers(r.papers))
      .catch((e) => live && setError(e instanceof ApiError ? e.message : tr('Pas de réseau, réessaie.')))
    return () => void (live = false)
  }, [sim.id])
  const show = async (p: Paper) => {
    setBusy(true)
    try {
      const { ref } = await api.shareTicket(sim.id, 'papier', p.id)
      share({ title: tr('Montrer mon papier'), body: ref })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : tr('Pas de réseau, réessaie.'))
    }
    setBusy(false)
  }
  if (error && !papers) return <p className="p-4 text-center text-sm font-bold text-[var(--color-ink-soft)]">{error}</p>
  if (!papers)
    return (
      <div className="space-y-2 p-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[64px] animate-pulse rounded-2xl bg-black/5" />
        ))}
      </div>
    )
  if (open)
    return (
      <div className="space-y-3 p-3" data-paper-open={open.kind}>
        <button className="inline-flex items-center gap-1 text-[13px] font-extrabold text-[var(--color-ink-soft)]" onClick={() => setOpen(null)}>
          <ChevronLeft size={16} /> {tr('Mes papiers')}
        </button>
        <PaperCard paper={open} gender={sim.gender} />
        <button className="btn w-full" disabled={busy} onClick={() => void show(open)}>
          <Send size={17} /> {tr('Montrer à un ami')}
        </button>
        {error && <p className="text-center text-[12px] font-bold text-[#c92a2a]">{error}</p>}
      </div>
    )
  const live = papers.filter((p) => !p.ended)
  const old = papers.filter((p) => p.ended)
  const have = new Set(live.filter((p) => !p.expiresAt || new Date(p.expiresAt).getTime() > Date.now()).map((p) => p.kind))
  const row = (p: Paper) => {
    const k = PAPER_KINDS[p.kind]
    const st = status(p)
    return (
      <button key={p.id} className="flex w-full items-center gap-3 rounded-2xl bg-white p-2.5 text-left shadow-[0_1px_0_rgba(15,18,48,0.08)] active:scale-[0.99]" onClick={() => setOpen(p)} data-paper-row={p.kind}>
        <IconTile icon={k?.icon ?? FileText} colors={k?.colors ?? ['#ccc', '#999']} size={42} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate font-display text-[15px] font-extrabold">{k?.title ?? p.kind}</span>
          <span className={`mt-0.5 block truncate text-[12px] font-bold ${st.tone === 'warn' ? 'text-[#c25400]' : 'text-[var(--color-ink-soft)]'}`}>
            {p.number}
            {p.legalised ? ` · ${tr('légalisé')}` : ''} · {st.label}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-[var(--color-ink-soft)]" />
      </button>
    )
  }
  return (
    <div className="space-y-4 p-3 pb-6">
      <p className="rounded-2xl bg-[#fff6e0] px-3 py-2 text-[12px] leading-snug font-bold text-[#7a5200]">{tr('Les papiers de ton perso, dans Babi Life seulement : ce sont des documents de jeu, sans valeur dans la vraie vie.')}</p>
      <section className="space-y-2">
        <h3 className="px-1 text-[12px] font-extrabold tracking-wide text-[var(--color-ink-soft)] uppercase">{tr('Mes papiers')}</h3>
        {live.map(row)}
      </section>
      <section className="space-y-2">
        <h3 className="px-1 text-[12px] font-extrabold tracking-wide text-[var(--color-ink-soft)] uppercase">{tr('À obtenir')}</h3>
        {toGet(have, minor).map((x) => {
          const k = PAPER_KINDS[x.kind]
          return (
            <div key={x.kind} className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-[var(--color-line)] p-2.5" data-paper-todo={x.kind}>
              <IconTile icon={k.icon} colors={['#d9dde8', '#9aa1b5']} size={38} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-display text-[14px] font-extrabold">{k.title}</span>
                <span className="mt-0.5 block text-[12px] font-bold text-[var(--color-ink-soft)]">{x.how}</span>
              </span>
              {x.place && onGo && (
                <button className="btn btn-soft !min-h-0 shrink-0 !px-2.5 !py-2 !text-[12px]" onClick={() => onGo(x.place!)}>
                  <MapPin size={14} /> {tr('Y aller')}
                </button>
              )}
            </div>
          )
        })}
      </section>
      {old.length > 0 && (
        <section className="space-y-2">
          <h3 className="px-1 text-[12px] font-extrabold tracking-wide text-[var(--color-ink-soft)] uppercase">{tr('Anciens papiers')}</h3>
          {old.map(row)}
        </section>
      )}
    </div>
  )
}
