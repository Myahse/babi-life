import { useMemo } from 'react'

// The loading screen's perso (components/Splash.tsx): a blocky one like the
// game's, drawn flat so it shows at once (no 3D to load), dancing the
// coupé-décalé: arms swinging up and down in turn, the knees bending to the
// beat, the head nodding. A different look each time: skin, hair, pagne.

const SKINS = ['#8a5532', '#6e4024', '#a46c42', '#583119', '#3f2210']
const OUTFITS: [string, string][] = [
  ['#ff7a00', '#ffd43b'],
  ['#00a862', '#f8f9fa'],
  ['#7b5cff', '#ffc233'],
  ['#e83e8c', '#ffffff'],
  ['#2a6cf0', '#ff7a00'],
]
const BOTTOMS = ['#1f2a44', '#3d2a1e', '#2b2d42', '#14213d']

export function SplashDancer({ size = 120 }: { size?: number }) {
  const look = useMemo(() => {
    const k = Math.floor(Math.random() * 1000)
    return { skin: SKINS[k % SKINS.length], outfit: OUTFITS[k % OUTFITS.length], bottom: BOTTOMS[k % BOTTOMS.length], braids: k % 2 === 0 }
  }, [])
  const [top, trim] = look.outfit
  return (
    <svg className="splash-dancer" width={size} height={size * 1.5} viewBox="0 0 64 96" aria-hidden shapeRendering="crispEdges">
      <g className="dancer-body">
        {/* The legs, each from the hip */}
        <g className="dancer-leg-l">
          <rect x="22" y="60" width="9" height="22" fill={look.bottom} />
          <rect x="21" y="81" width="11" height="5" fill="#141016" />
        </g>
        <g className="dancer-leg-r">
          <rect x="33" y="60" width="9" height="22" fill={look.bottom} />
          <rect x="32" y="81" width="11" height="5" fill="#141016" />
        </g>
        {/* The top in pagne, its band of colour */}
        <rect x="20" y="36" width="24" height="26" fill={top} />
        <rect x="20" y="48" width="24" height="4" fill={trim} />
        <rect x="26" y="40" width="3" height="3" fill={trim} />
        <rect x="35" y="55" width="3" height="3" fill={trim} />
        {/* The arms, from the shoulders */}
        <g className="dancer-arm-l">
          <rect x="12" y="36" width="8" height="18" fill={top} />
          <rect x="12" y="54" width="8" height="6" fill={look.skin} />
        </g>
        <g className="dancer-arm-r">
          <rect x="44" y="36" width="8" height="18" fill={top} />
          <rect x="44" y="54" width="8" height="6" fill={look.skin} />
        </g>
        {/* The head: the face, the eyes, the smile, the hair */}
        <g className="dancer-head">
          <rect x="20" y="12" width="24" height="24" fill={look.skin} />
          <rect x="18" y="8" width="28" height="8" fill="#141010" />
          {look.braids ? (
            <>
              <rect x="16" y="12" width="5" height="18" fill="#141010" />
              <rect x="43" y="12" width="5" height="18" fill="#141010" />
            </>
          ) : (
            <rect x="18" y="12" width="4" height="6" fill="#141010" />
          )}
          <rect x="25" y="21" width="4" height="4" fill="#ffffff" />
          <rect x="35" y="21" width="4" height="4" fill="#ffffff" />
          <rect x="26" y="22" width="2" height="3" fill="#1b1b20" />
          <rect x="36" y="22" width="2" height="3" fill="#1b1b20" />
          <rect x="28" y="29" width="8" height="2" fill="#5a1e1e" />
          <rect x="29" y="31" width="6" height="1" fill="#ffffff" />
        </g>
      </g>
    </svg>
  )
}
