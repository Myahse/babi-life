// Minimal hook runtime: enough for usePoseRig (useRef slots per instance).
let cur = null
export const withInstance = (inst, fn) => { cur = inst; inst.i = 0; try { return fn() } finally { cur = null } }
export const useRef = (v) => { if (!cur) return { current: v }; const k = cur.i++; return (cur.refs[k] ??= { current: v }) }
export const useState = (v) => [typeof v === 'function' ? v() : v, () => {}]
export const createContext = (v) => ({ _v: v, Provider: () => null })
export const useContext = (c) => c._v
export const useMemo = (f) => f()
export const useEffect = () => {}
export default {}
