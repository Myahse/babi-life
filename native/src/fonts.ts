import { Asset } from 'expo-asset'
import { Skia } from '@shopify/react-native-skia'
import { registerFont } from '@web/lib/canvas'

// The fonts the game paints its canvases with (signs, clothes, posters): Skia's, from the app's files.
export async function paintFonts(files: [string, number, number][]) {
  await Promise.all(
    files.map(async ([family, weight, file]) => {
      const asset = await Asset.fromModule(file).downloadAsync()
      const face = Skia.Typeface.MakeFreeTypeFaceFromData(await Skia.Data.fromURI(asset.localUri ?? asset.uri))
      if (!face) return
      registerFont(`${family}|${weight}`, face)
      // The family alone: its usual weight (the game's text is mostly bold).
      if (weight === 800 || (family !== 'Nunito' && family !== 'Baloo 2')) registerFont(family, face)
    }),
  )
}
