let cbs = []
export const useFrame = (cb) => { cbs.push(cb) }
export const takeFrames = () => { const c = cbs; cbs = []; return c }
