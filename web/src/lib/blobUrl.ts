/** A downloaded picture made something an <img> shows: an object URL in the browser (blobUrl.native.ts in the app). */
export const blobUrl = (blob: Blob): Promise<string> => Promise.resolve(URL.createObjectURL(blob))
