import type { ComponentProps, ReactNode } from 'react'
import { Human, type Pose } from '../avatar/Human'
import { useNpcReaction } from './open/npcReact'
import { doingOf, nameFor, talkTo, useTalking, type Npc } from './talk'

/** The poses one leaves to talk; the others (dancing, eating, praying, walking on) go on, the person answering over them. */
const STOPS = new Set<Pose>(['idle', 'sit', 'phone'])

/**
 * Someone in a scene you can tap to talk to (world3d/talk.ts). While you
 * talk they react to what you say (a laugh, a shrug); someone standing about
 * turns to talking, someone dancing keeps dancing. `children` draws them in
 * the pose to show.
 */
export function Talkable({ npc, pose, children }: { npc: Npc; pose: Pose; children: (pose: Pose) => ReactNode }) {
  const reaction = useNpcReaction()
  const talking = useTalking() === npc.id
  const shown: Pose = reaction?.id === npc.id ? reaction.pose : talking && STOPS.has(pose) ? (pose === 'sit' ? 'sit' : 'talk') : pose
  return (
    <group
      onClick={(e) => {
        e.stopPropagation()
        talkTo(npc)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      {children(shown)}
    </group>
  )
}

/**
 * A person drawn as usual (avatar/Human) who can be talked to: `id` makes them
 * the same someone every visit, their name and what they're at come from it.
 */
export function TalkHuman({ id, ...props }: ComponentProps<typeof Human> & { id: string }) {
  const pose = props.pose ?? 'idle'
  const seed = Math.floor(Math.abs(props.seed ?? 0) * 1000)
  const npc: Npc = { id, name: nameFor(props.gender, seed), gender: props.gender, seed, look: props.look, doing: doingOf(pose) }
  return <Talkable npc={npc} pose={pose}>{(shown) => <Human {...props} pose={shown} />}</Talkable>
}
