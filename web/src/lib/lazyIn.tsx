import { Suspense, lazy, type ComponentProps, type ComponentType, type ReactNode } from 'react'

/**
 * A component loaded the first time it's shown (not with the game: the screen comes up sooner), with its
 * own Suspense so that loading it never blanks the rest of the screen: nothing (or `fallback`) the moment
 * it takes, then it. Used like the component itself.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyIn<T extends ComponentType<any>>(load: () => Promise<{ default: T }>, fallback: ReactNode = null) {
  const C = lazy(load)
  const Loaded = (props: ComponentProps<T>) => (
    <Suspense fallback={fallback}>
      <C {...props} />
    </Suspense>
  )
  return Loaded
}
