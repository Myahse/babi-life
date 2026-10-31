import { registerRootComponent } from 'expo'

import Shell from './Shell'

// The app is the website's game in the phone's own web view (Shell.tsx). (App.tsx, the game drawn by
// React Native through src/dom and src/shims, is the earlier way: kept for now, no longer started.)
registerRootComponent(Shell)
