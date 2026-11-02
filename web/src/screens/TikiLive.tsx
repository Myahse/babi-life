import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ChevronLeft, Heart, Mic, MicOff, Radio, Send, Users, Volume2, VolumeX, X } from 'lucide-react'
import type { Pose } from '../avatar/Human'
import { Character } from '../world3d/Character'
import type { Look, Sim } from '../lib/types'
import { canHear, canSpeak, endLive, goLive, LiveConn, setMic, Speaker, tellDoing, tikiLives, useHosting, type LiveSay, type TikiLive } from '../lib/tikiLive'
import { t as tr, tx } from '../lib/i18n'

// Tikitoko Live (lib/tikiLive.ts, backend live/tiki.go): the lives on now and going live (the app's
// « Live » tab), a live watched (the streamer's Sim as it is, its voice, the comments, the hearts), and
// the streamer's bar over the game while it plays live (Play's LiveBar).

const since = (ms: number) => {
  const m = Math.max(1, Math.round((Date.now() - ms) / 60000))
  return m < 60 ? tx('{0} min', { 0: m }) : tx('{0} h', { 0: Math.floor(m / 60) })
}

/** The Sim on its little stage, in the pose it's in. */
function LiveSim({ look, gender, stage, pose }: { look: Look; gender: 'femme' | 'homme'; stage: string; pose: Pose }) {
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 1.4, 4.2], fov: 42 }} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <Suspense fallback={null}>
        <hemisphereLight args={['#ffffff', '#3a2a4a', 1.1]} />
        <directionalLight position={[2, 4, 3]} intensity={1.3} />
        <group position={[0, -0.9, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.4, 32]} />
            <meshLambertMaterial color="#2a1f3d" />
          </mesh>
          <Character look={look} gender={gender} pose={pose} stage={stage} marker={false} />
        </group>
      </Suspense>
    </Canvas>
  )
}

/** The hearts floating up from the button, each one a little way. */
function Hearts({ count }: { count: number }) {
  const [list, setList] = useState<{ k: number; x: number; c: string }[]>([])
  const prev = useRef(count)
  useEffect(() => {
    const n = Math.min(6, count - prev.current)
    prev.current = count
    if (n <= 0) return
    const add = [...Array(n)].map((_, i) => ({ k: Date.now() + i, x: Math.random() * 40 - 20, c: ['#ff3b6b', '#ff7a00', '#ffd43b', '#12c48b', '#a855f7'][Math.floor(Math.random() * 5)] }))
    setList((l) => [...l.slice(-20), ...add])
    const t = setTimeout(() => setList((l) => l.filter((h) => !add.includes(h))), 2200)
    return () => clearTimeout(t)
  }, [count])
  return (
    <div className="pointer-events-none absolute right-4 bottom-24 h-64 w-16">
      {list.map((h) => (
        <Heart key={h.k} size={26} fill={h.c} color={h.c} className="absolute bottom-0 animate-[tikiHeart_2.2s_ease-out_forwards]" style={{ left: 20 + h.x }} />
      ))}
      <style>{'@keyframes tikiHeart{0%{transform:translateY(0) scale(.6);opacity:1}100%{transform:translateY(-240px) scale(1.2);opacity:0}}'}</style>
    </div>
  )
}

/** The comments, the newest at the bottom, the older ones fading up. */
function Says({ says }: { says: LiveSay[] }) {
  return (
    <div className="pointer-events-none flex max-h-[38vh] flex-col justify-end gap-1.5 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_30%)]">
      {says.slice(-12).map((s) => (
        <div key={s.at + s.id} className="w-fit max-w-[85%] rounded-2xl bg-black/35 px-3 py-1.5 text-[13px] leading-tight">
          <b className={s.host ? 'text-[#ffd43b]' : 'text-white/70'}>{s.n}</b> <span>{s.s}</span>
        </div>
      ))}
    </div>
  )
}

/* ---------- The « Live » tab: the lives on now, and going live ---------- */

export function LiveTab({ sim, stage, onWatch, onClose }: { sim: Sim; stage: string; onWatch: (l: TikiLive) => void; onClose: () => void }) {
  const [lives, setLives] = useState<TikiLive[] | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const hosting = useHosting()
  useEffect(() => {
    const load = () => void tikiLives().then(setLives).catch(() => setLives([]))
    load()
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [])
  const go = async () => {
    setBusy(true)
    setErr('')
    try {
      await goLive(sim.id, title, stage)
      // Live: back to the game, the live's bar over it (the viewers watch the Sim as it plays).
      onClose()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const others = (lives ?? []).filter((l) => l.id !== sim.id)
  return (
    <div className="absolute inset-0 overflow-y-auto bg-gradient-to-b from-[#2a0f2f] to-black px-4 pt-[calc(1rem+var(--sat,env(safe-area-inset-top)))] pb-6">
      <h2 className="flex items-center gap-2 text-xl font-extrabold">
        <Radio size={22} className="text-[#ff3b6b]" /> {tr('Live')}
      </h2>
      {/* Going live */}
      {hosting ? (
        <div className="mt-4 rounded-2xl bg-[#ff3b6b]/20 p-4 text-sm font-bold">{tr('Tu es en live. Ferme Tikitoko pour jouer : tes spectateurs te suivent.')}</div>
      ) : (
        <div className="mt-4 rounded-2xl bg-white/10 p-4">
          <div className="text-sm font-extrabold">{tr('Lancer mon live')}</div>
          <p className="mt-1 text-[12px] font-bold text-white/60">{tr('Les autres joueurs te regardent jouer en direct, entendent ta voix si tu ouvres le micro, commentent et envoient des cœurs.')}</p>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder={tr('Titre du live (ex. : Soirée à Bassam)')} className="mt-3 w-full rounded-xl bg-black/40 px-3 py-2.5 text-sm font-bold text-white placeholder:text-white/40" />
          <button disabled={busy} onClick={go} className="mt-3 w-full rounded-xl bg-[#ff3b6b] py-3 text-sm font-extrabold disabled:opacity-50">
            {busy ? tr('Un instant…') : tr('Passer en live')}
          </button>
          {err && <p className="mt-2 text-[12px] font-bold text-[#ffb4b4]">{err}</p>}
        </div>
      )}
      {/* The lives on now */}
      <div className="mt-6 text-sm font-extrabold text-white/80">{tr('En direct maintenant')}</div>
      {lives === null ? (
        <p className="mt-3 text-sm font-bold text-white/50">{tr('Chargement…')}</p>
      ) : others.length === 0 ? (
        <p className="mt-3 text-sm font-bold text-white/50">{tr('Personne en live pour le moment. Lance le tien !')}</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {others.map((l) => (
            <button key={l.id} onClick={() => onWatch(l)} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-gradient-to-b from-[#5b1a63] to-[#140818] text-left">
              <span className="absolute top-2 left-2 rounded-md bg-[#ff3b6b] px-1.5 py-0.5 text-[10px] font-extrabold">LIVE</span>
              <span className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-extrabold">
                <Users size={11} /> {l.viewers}
              </span>
              <span className="absolute inset-x-2 bottom-2">
                <span className="block truncate text-sm font-extrabold">{l.name}</span>
                <span className="block truncate text-[11px] font-bold text-white/70">{l.title}</span>
                <span className="block truncate text-[10px] font-bold text-white/50">{l.doing || since(l.started)}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Watching a live ---------- */

export function LiveWatch({ sim, live, onBack }: { sim: Sim; live: TikiLive; onBack: () => void }) {
  const [says, setSays] = useState<LiveSay[]>([])
  const [hearts, setHearts] = useState(live.hearts)
  const [doing, setDoing] = useState({ s: live.doing, p: 'idle' as Pose, mic: live.mic, viewers: live.viewers })
  const [ended, setEnded] = useState('')
  const [text, setText] = useState('')
  const [muted, setMuted] = useState(false)
  const [needTap, setNeedTap] = useState(true)
  const conn = useRef<LiveConn | null>(null)
  const speaker = useRef<Speaker | null>(null)
  useEffect(() => {
    const sp = canHear() ? new Speaker() : null
    speaker.current = sp
    const c = new LiveConn(sim.id, live.id, {
      onSay: (s) => setSays((l) => [...l.slice(-40), s]),
      onHeart: setHearts,
      onDoing: (d) => (setDoing({ s: d.s, p: d.p, mic: d.mic, viewers: d.viewers }), setHearts(d.hearts)),
      onEnd: () => setEnded(tr('Le live est terminé.')),
      onError: (why) => setEnded(why),
      onVoice: (p) => sp?.play(p),
    })
    conn.current = c
    return () => {
      c.close()
      sp?.close()
    }
  }, [sim.id, live.id])
  useEffect(() => {
    if (speaker.current) speaker.current.muted = muted
  }, [muted])
  const send = () => {
    const s = text.trim()
    if (!s) return
    conn.current?.say(s)
    setText('')
  }
  return (
    <div
      className="absolute inset-0 bg-gradient-to-b from-[#3b1546] via-[#1d0d26] to-black"
      onClick={() => {
        speaker.current?.wake()
        setNeedTap(false)
      }}
    >
      <LiveSim look={live.look as unknown as Look} gender={live.gender} stage={live.stage} pose={doing.p} />
      {/* The top: who, the LIVE badge, the viewers, closing */}
      <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-3 pt-[calc(0.75rem+var(--sat,env(safe-area-inset-top)))]">
        <button onClick={onBack} className="grid h-9 w-9 place-items-center rounded-full bg-black/40" aria-label={tr('Retour')}>
          <ChevronLeft size={22} />
        </button>
        <div className="min-w-0 flex-1 rounded-full bg-black/40 px-3 py-1.5">
          <div className="truncate text-sm font-extrabold">{live.name}</div>
          <div className="truncate text-[11px] font-bold text-white/70">{live.title}</div>
        </div>
        <span className="rounded-md bg-[#ff3b6b] px-2 py-1 text-[11px] font-extrabold">LIVE</span>
        <span className="flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-[11px] font-extrabold">
          <Users size={12} /> {doing.viewers}
        </span>
      </div>
      {/* What the Sim is doing, and its voice */}
      <div className="absolute inset-x-0 top-[calc(4.6rem+var(--sat,env(safe-area-inset-top)))] flex flex-col items-center gap-1.5 px-6 text-center">
        {doing.s && <span className="rounded-full bg-black/40 px-3 py-1 text-[12px] font-bold">{doing.s}</span>}
        <span className="flex items-center gap-1.5 text-[11px] font-bold text-white/70">
          {doing.mic ? <Mic size={13} className="text-[#12c48b]" /> : <MicOff size={13} />}
          {doing.mic ? (canHear() ? tr('Micro ouvert') : tr('Ce téléphone ne peut pas lire la voix du live')) : tr('Micro fermé')}
        </span>
        {doing.mic && canHear() && needTap && <span className="animate-pulse rounded-full bg-white/15 px-3 py-1 text-[12px] font-extrabold">{tr('Touche l’écran pour entendre')}</span>}
      </div>
      <Hearts count={hearts} />
      {/* The comments, writing one, a heart, the sound */}
      <div className="absolute inset-x-0 bottom-0 px-3 pb-[calc(0.75rem+var(--sab,env(safe-area-inset-bottom)))]">
        <Says says={says} />
        {ended ? (
          <div className="mt-3 rounded-2xl bg-white/10 p-4 text-center font-extrabold">{ended}</div>
        ) : (
          <div className="mt-3 flex items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value.slice(0, 120))} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={tr('Ajoute un commentaire…')} className="min-w-0 flex-1 rounded-full bg-white/15 px-4 py-2.5 text-sm font-bold text-white placeholder:text-white/50" />
            <button onClick={send} className="grid h-10 w-10 place-items-center rounded-full bg-white/15" aria-label={tr('Envoyer')}>
              <Send size={18} />
            </button>
            <button onClick={() => setMuted((m) => !m)} className="grid h-10 w-10 place-items-center rounded-full bg-white/15" aria-label={muted ? tr('Remettre le son') : tr('Couper le son')}>
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button onClick={() => conn.current?.heart()} className="grid h-12 w-12 place-items-center rounded-full bg-[#ff3b6b]" aria-label={tr('Envoyer un cœur')}>
              <Heart size={22} fill="#fff" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- The streamer's bar, over the game, while it's live ---------- */

export function LiveBar({ sim, doing, pose }: { sim: Sim; /** What the Sim is doing now and where (a few words). */ doing: string; pose: () => Pose }) {
  const hosting = useHosting()
  const [open, setOpen] = useState(false)
  const [micErr, setMicErr] = useState('')
  const [level, setLevel] = useState(0)
  const doingRef = useRef(doing)
  doingRef.current = doing
  // What the Sim does, to the viewers, every couple of seconds; the mic's level for the bars.
  useEffect(() => {
    if (!hosting) return
    tellDoing(doingRef.current, pose())
    const t = setInterval(() => tellDoing(doingRef.current, pose()), 2000)
    const l = setInterval(() => setLevel(hosting.mic?.level ?? 0), 120)
    return () => (clearInterval(t), clearInterval(l))
  }, [hosting?.live.id, hosting?.mic]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!hosting) return null
  const mic = !!hosting.mic
  const toggleMic = async () => {
    setMicErr('')
    try {
      await setMic(!mic)
    } catch {
      setMicErr(tr('Le micro n’est pas accessible : autorise-le dans les réglages du téléphone.'))
    }
  }
  return (
    <div className="pointer-events-auto absolute top-[calc(8.9rem+var(--sat,env(safe-area-inset-top)))] left-3 z-30 w-[min(270px,calc(100vw-6.5rem))]">
      <div className="flex items-center gap-2 rounded-2xl bg-black/70 px-2.5 py-2 text-white shadow-lg backdrop-blur">
        <span className="rounded-md bg-[#ff3b6b] px-1.5 py-0.5 text-[10px] font-extrabold">LIVE</span>
        <span className="flex items-center gap-1 text-[12px] font-extrabold">
          <Users size={13} /> {hosting.viewers}
        </span>
        <span className="flex items-center gap-1 text-[12px] font-extrabold">
          <Heart size={13} fill="#ff3b6b" color="#ff3b6b" /> {hosting.hearts}
        </span>
        <span className="flex-1" />
        {canSpeak() && (
          <button onClick={toggleMic} className={`flex h-8 items-center gap-1 rounded-full px-2 ${mic ? 'bg-[#12c48b]' : 'bg-white/15'}`} aria-label={mic ? tr('Fermer le micro') : tr('Ouvrir le micro')}>
            {mic ? <Mic size={15} /> : <MicOff size={15} />}
            {mic && (
              <span className="flex h-3 items-end gap-[2px]">
                {[0.2, 0.45, 0.7].map((k) => (
                  <i key={k} className="w-[3px] rounded-sm bg-white" style={{ height: `${Math.min(100, 20 + Math.max(0, level - k * 0.3) * 260)}%` }} />
                ))}
              </span>
            )}
          </button>
        )}
        <button onClick={() => setOpen((o) => !o)} className="h-8 rounded-full bg-white/15 px-2 text-[11px] font-extrabold">
          {open ? tr('Masquer') : tr('Chat')}
        </button>
        <button onClick={() => void endLive(sim.id)} className="grid h-8 w-8 place-items-center rounded-full bg-white/15" aria-label={tr('Arrêter le live')}>
          <X size={16} />
        </button>
      </div>
      {micErr && <div className="mt-1 rounded-xl bg-black/70 px-2.5 py-1.5 text-[11px] font-bold text-[#ffb4b4]">{micErr}</div>}
      {/* The last comments under it (the whole chat on a tap) */}
      <div className="mt-1.5">
        <Says says={open ? hosting.says : hosting.says.slice(-2)} />
      </div>
    </div>
  )
}
