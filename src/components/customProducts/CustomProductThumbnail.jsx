import { useEffect, useState } from 'react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { customProductPaths } from '../../services/customProductApi'
import { readData } from '../../services/workspace'
import { Avatar } from '../ui/Avatar'

export function CustomProductThumbnail({ product }) {
  const { base } = useWorkspace()
  const path = customProductPaths.detail(base, product.id)
  const imageKey = `${path}:${product.revision}`
  const [image, setImage] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    let refreshTimer

    async function load() {
      try {
        const media = await readData(`${path}/media`, { signal: controller.signal })
        const assetId = media.effectiveAssetId || media.items?.find((asset) => asset.state === 'ready')?.id
        if (!assetId) {
          if (!controller.signal.aborted) setImage(null)
          return
        }
        const access = await readData(`${path}/media/${encodeURIComponent(assetId)}/access`, {
          signal: controller.signal,
        })
        const url = new URL(access.url)
        if (url.protocol !== 'https:' || url.username || url.password) {
          throw new Error('Invalid product image URL')
        }
        if (controller.signal.aborted) return
        setImage({ key: imageKey, src: url.href })
        // Private URLs expire. Refresh while the row is mounted, keeping URLs
        // in component memory rather than persisting them with product data.
        const ttl = Math.min(300, Number(access.expiresInSeconds) || 300)
        refreshTimer = setTimeout(load, Math.max(1000, (ttl - 5) * 1000))
      } catch {
        if (!controller.signal.aborted) setImage(null)
      }
    }

    void load()
    return () => {
      controller.abort()
      clearTimeout(refreshTimer)
    }
  }, [path, imageKey, product])

  return (
    <Avatar
      name={product.name?.trim().replace(/\s+/g, ' ') || ''}
      src={image?.key === imageKey ? image.src : undefined}
      className="product-list-thumbnail"
      aria-hidden="true"
      onError={() => setImage(null)}
    />
  )
}
