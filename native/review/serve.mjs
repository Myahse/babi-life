// The review's own copy of the site (native-review.yml): web/'s build served on a port, every page
// that isn't a file answered with index.html (the game's routes: /jeu, /liste…), as Vercel does.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const [root, port] = [process.argv[2], Number(process.argv[3] || 5173)]
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.glb': 'model/gltf-binary', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' }
http
  .createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let file = path.join(root, url)
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html')
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  .listen(port, () => console.log(`site on :${port}`))
