// Firebase's sign-in pages (/__/auth/…), served from this site's own domain:
// the home-screen app on an iPhone goes to Google and back through them, and
// Safari keeps what Firebase stored on the way only on the site's domain
// (src/lib/google.ts). vercel.json sends /__/auth/ here; this passes it on to
// the project's firebaseapp.com and hands the answer back as it is.

export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const project = process.env.VITE_FIREBASE_PROJECT_ID
  if (!project) return new Response('Firebase non configuré', { status: 404 })
  const url = new URL(req.url)
  const path = url.searchParams.get('path') ?? ''
  url.searchParams.delete('path')
  const target = `https://${project}.firebaseapp.com/__/auth/${path}${url.searchParams.size ? `?${url.searchParams}` : ''}`
  const headers = new Headers(req.headers)
  headers.delete('host')
  const res = await fetch(target, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : await req.arrayBuffer(), redirect: 'manual' })
  return new Response(res.body, { status: res.status, headers: res.headers })
}
