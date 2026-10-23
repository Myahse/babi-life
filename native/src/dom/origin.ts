// The website, where the game's own files (pictures, sounds) are fetched from and its links go.
export const WEB_ORIGIN = 'https://www.lifeinbabi.com'
export const absUrl = (u: string) => (u.startsWith('/') ? `${WEB_ORIGIN}${u}` : u)
