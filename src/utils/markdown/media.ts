import type { ImageType } from './types'

export async function fetchImage(url: string | undefined): Promise<{
  data: ArrayBuffer
  transformation: { width: number; height: number }
  type: ImageType
} | null> {
  if (!url) return null
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const arrayBuffer = await blob.arrayBuffer()

    let width = 320
    let height = 240

    if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
      try {
        const bitmap = await createImageBitmap(blob)
        width = Math.min(480, Math.max(120, bitmap.width))
        height = Math.min(480, Math.max(120, bitmap.height))
        bitmap.close()
      } catch {
        // keep fallback dimensions
      }
    }

    const type = resolveImageType(blob.type)

    return {
      data: arrayBuffer,
      type,
      transformation: {
        width,
        height,
      },
    }
  } catch {
    return null
  }
}

export function resolveImageType(mime: string): ImageType {
  if (mime?.includes('png')) return 'png'
  if (mime?.includes('jpeg') || mime?.includes('jpg')) return 'jpg'
  if (mime?.includes('gif')) return 'gif'
  if (mime?.includes('bmp')) return 'bmp'
  return 'png'
}

