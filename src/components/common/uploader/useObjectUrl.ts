import { useEffect, useState } from 'react'

/**
 * Creates an object URL for a File/Blob and revokes it on change/unmount.
 */
export function useObjectUrl(source: Blob | File | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!source) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(source)
    setUrl(next)
    return () => {
      URL.revokeObjectURL(next)
    }
  }, [source])

  return url
}

/** Revoke a list of object URLs (e.g. on unmount of a file list). */
export function revokeObjectUrls(urls: Array<string | null | undefined>) {
  for (const url of urls) {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  }
}
