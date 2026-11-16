import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { MentionPick } from '../lib/types'
import { ChatAvatar } from './ChatScreen'
import { t as tr } from '../lib/i18n'

/**
 * Tagging people in the grin (update « mentions-grin », backend sims/mentions.go): « @ » typed in the box
 * opens the players to name, as the name is typed (who wrote in the room lately, friends, then anyone by
 * username); a tap puts « @username » in. In the messages, the names the server found are lit up, and a
 * message naming me is tinted. The rules for what counts as a mention are the server's (parseMentions).
 */

/** What a mention's box needs from the room. */
export type MentionKit = {
  /** My username, in lower case: the messages naming me are tinted. */
  me: string
  /** The room's own suggestions, at once (who wrote in it lately). */
  local: (q: string) => MentionPick[]
  /** The server's, a moment later. */
  search: (q: string) => Promise<MentionPick[]>
}

const nameChar = (c: string) => /[A-Za-z0-9_.]/.test(c)
const wordChar = (c: string) => /[\p{L}\p{N}_.@]/u.test(c)

/** The « @name » being typed at the caret: where its « @ » is and what follows it so far, or null. */
export function mentionAt(text: string, caret: number): { start: number; q: string } | null {
  let i = caret
  while (i > 0 && nameChar(text[i - 1]) && caret - i < 24) i--
  if (i === 0 || text[i - 1] !== '@') return null
  const start = i - 1
  if (start > 0 && wordChar(text[start - 1])) return null
  // The caret inside a word that goes on: not a name being typed.
  if (caret < text.length && /[\p{L}\p{N}]/u.test(text[caret])) return null
  return { start, q: text.slice(i, caret) }
}

/** The text with the name being typed replaced by « @username », and where the caret goes. */
export function insertMention(text: string, at: { start: number }, caret: number, username: string) {
  const after = text.slice(caret)
  const put = `@${username}${after.startsWith(' ') ? '' : ' '}`
  const next = (text.slice(0, at.start) + put + after).slice(0, 500)
  return { text: next, caret: Math.min(next.length, at.start + put.length + (after.startsWith(' ') ? 1 : 0)) }
}

/** A message's text, its « @names » lit up (only those the server found: real players). */
export function MentionText({ body, names, me, onTap }: { body: string; names: string[]; me: string; onTap?: (username: string) => void }) {
  const parts: ReactNode[] = []
  const re = /(^|[^\p{L}\p{N}_.@])@([A-Za-z0-9_.]{3,24})(?![\p{L}\p{N}])/gu
  let from = 0
  for (const m of body.matchAll(re)) {
    const raw = m[2].replace(/\.+$/, '')
    const name = raw.toLowerCase()
    if (!names.includes(name)) continue
    const at = m.index! + m[1].length
    if (at > from) parts.push(body.slice(from, at))
    const mine = name === me
    parts.push(
      <button
        key={at}
        type="button"
        className={`inline rounded px-0.5 font-extrabold ${mine ? 'bg-[#f59f00] text-white' : 'bg-[#1971c2]/10 text-[#1971c2]'}`}
        onClick={(e) => (e.stopPropagation(), onTap?.(raw))}
        aria-label={mine ? tr('Toi, mentionné·e') : tr('Répondre à @{0}', { 0: raw })}
      >
        @{raw}
      </button>,
    )
    from = at + 1 + raw.length
  }
  if (!parts.length) return <>{body}</>
  if (from < body.length) parts.push(body.slice(from))
  return <>{parts}</>
}

/** The players to name as « @q » is typed: the room's at once, the server's as they come (asked once a query, a little after the last key). */
export function useMentionPicks(kit: MentionKit | undefined, q: string | null) {
  const asked = useRef(new Map<string, MentionPick[]>())
  const [, setGot] = useState(0)
  // The room's kit changes as messages come: the request follows the query only.
  const kitNow = useRef(kit)
  kitNow.current = kit
  const on = !!kit
  useEffect(() => {
    if (!on || q === null || asked.current.has(q.toLowerCase())) return
    const key = q.toLowerCase()
    const t = setTimeout(
      () =>
        void kitNow.current
          ?.search(key)
          .then((list) => (asked.current.set(key, list), setGot((n) => n + 1)))
          .catch(() => undefined),
      q ? 220 : 0,
    )
    return () => clearTimeout(t)
  }, [on, q])
  if (!kit || q === null) return []
  const key = q.toLowerCase()
  const fits = (p: MentionPick) => p.username.toLowerCase().startsWith(key) || p.firstName.toLowerCase().startsWith(key)
  // While the server thinks: what it said for a shorter start of the name, still fitting.
  let remote = asked.current.get(key)
  for (let n = key.length - 1; !remote && n >= 0; n--) remote = asked.current.get(key.slice(0, n))?.filter(fits)
  const out: MentionPick[] = []
  for (const p of [...kit.local(key).filter(fits), ...(remote ?? [])]) if (!out.some((o) => o.username.toLowerCase() === p.username.toLowerCase())) out.push(p)
  return out.slice(0, 6)
}

/** The list over the box: a row each (48 px), a tap puts the name in; the box keeps the keyboard. */
export function MentionList({ picks, hi, onPick }: { picks: MentionPick[]; hi: number; onPick: (p: MentionPick) => void }) {
  return (
    <ul role="listbox" aria-label={tr('Mentionner quelqu’un')} className="motion-pop mb-1.5 max-h-[240px] overflow-y-auto overscroll-contain rounded-xl bg-white py-1 shadow-md">
      {picks.length === 0 && <li className="px-3 py-3 text-[13px] font-semibold text-[#667781]">{tr('Personne avec ce nom. Continue d’écrire…')}</li>}
      {picks.map((p, i) => (
        <li key={p.username} role="option" aria-selected={i === hi}>
          <button
            type="button"
            className={`flex min-h-12 w-full items-center gap-2.5 px-3 py-1.5 text-left active:bg-black/5 ${i === hi ? 'bg-black/[0.05]' : ''}`}
            // Keep the box focused (and the keyboard up) while the finger is on the row.
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(p)}
          >
            <ChatAvatar look={p.look} gender={p.gender} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] leading-tight font-extrabold text-[#111b21]">{p.firstName}</span>
              <span className="block truncate text-[12.5px] font-semibold text-[#667781]">@{p.username}</span>
            </span>
            {p.recent ? (
              <span className="shrink-0 rounded-full bg-[#c2410c]/10 px-2 py-0.5 text-[11px] font-extrabold text-[#c2410c]">{tr('Ici')}</span>
            ) : p.friend ? (
              <span className="shrink-0 rounded-full bg-[#2f9e44]/10 px-2 py-0.5 text-[11px] font-extrabold text-[#2f9e44]">{tr('Ami·e')}</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  )
}
