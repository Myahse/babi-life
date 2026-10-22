/** A downloaded picture made something an <Image> shows, in the app: a data URL (no object URLs in React Native). */
export const blobUrl = (blob: Blob): Promise<string> =>
  new Promise((ok, fail) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result))
    r.onerror = () => fail(r.error ?? new Error('photo illisible'))
    r.readAsDataURL(blob)
  })
