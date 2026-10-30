// The app's look in a browser (native/, react-native-web; Vite never takes .web files): the phone's
// way, the chunks built in the app's thread (its page address is the site's, a worker's script isn't there).
export { startChunkWorker, type ChunkWorker } from './chunkWorker.native'
