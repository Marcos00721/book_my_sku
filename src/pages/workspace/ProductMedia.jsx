import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { mutate, readData, queryPath } from '../../services/workspace'
import { uploadBytes } from '../../services/api'
import {
  Action,
  ErrorNotice,
  Loading,
} from '../../components/workspace/Elements'
import { VariantSelect } from '../../components/workspace/VariantSelect'
import {
  ConflictReview,
  MutationRetry,
} from '../../components/workspace/RecordTools'
import { useDraftGuard } from '../../hooks/useDraftGuard'
import { MultipleUploader } from '../../components/common/uploader'
import { Button } from '../../components/common'
import { askConfirm } from '../../components/common/confirm'
import { ProductImageList, ProductImagePreviewContent } from '../../components/customProducts/ProductImageList'

const IMAGE_PLACEHOLDER = {
  label: 'Upload product images',
  accept: ['image/jpeg', 'image/png', 'image/webp'],
  hint: 'JPG, PNG or WEBP · max 10 MB each · up to 20 images',
}

const MAX_FILES = 20
const MAX_SIZE_MB = 10

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

function sourceLabel(source) {
  if (source === 'variant') return 'Variant image'
  if (source === 'primary') return 'Product cover image'
  return 'No catalog image'
}

/** Short-lived private access URLs for ready assets. */
function useAssetAccessUrls(path, assets) {
  const [urls, setUrls] = useState({})
  const request = useRef(0)

  useEffect(() => {
    const ticket = ++request.current
    let cancelled = false
    const ready = (assets || []).filter((asset) => asset.state === 'ready')

    ;(async () => {
      if (!ready.length) {
        if (!cancelled && ticket === request.current) setUrls({})
        return
      }
      const next = {}
      await Promise.all(
        ready.map(async (asset) => {
          try {
            const result = await readData(`${path}/media/${asset.id}/access`)
            const url = new URL(result.url)
            if (url.protocol !== 'https:' || url.username || url.password) return
            next[asset.id] = {
              href: url.href,
              ttl: Math.min(300, Number(result.expiresInSeconds) || 300),
            }
          } catch {
            /* thumb failure is non-fatal */
          }
        }),
      )
      if (!cancelled && ticket === request.current) setUrls(next)
    })()

    return () => {
      cancelled = true
    }
  }, [path, assets])

  useEffect(() => {
    const timers = Object.entries(urls).map(([id, entry]) =>
      setTimeout(() => {
        setUrls((current) => {
          if (!current[id]) return current
          const copy = { ...current }
          delete copy[id]
          return copy
        })
      }, Math.max(0, (entry.ttl || 300) * 1000)),
    )
    return () => timers.forEach(clearTimeout)
  }, [urls])

  return urls
}

export function ProductMedia({ path, product, changed }) {
  const workspace = useWorkspace()
  const [variantId, setVariant] = useState('')
  const resource = useResource(queryPath(`${path}/media`, { variantId }))
  const [busyUpload, setBusyUpload] = useState(false)
  const [intentError, setIntentError] = useState(null)
  const [revisionDraft, setRevisionDraft] = useState(null)
  const [cleanupResult, setCleanupResult] = useState('')
  const association = useMutation()
  const cleanup = useMutation()
  /** Same original bytes → reuse reserved asset id for PUT retry. */
  const reserved = useRef(new Map())

  const editable =
    workspace.can('products.edit') &&
    workspace.writesAllowed &&
    product.status !== 'archived'

  useDraftGuard(busyUpload)

  const media = resource.data
  const accessUrls = useAssetAccessUrls(path, media?.items)
  const revision = revisionDraft ?? media?.revision ?? product.revision
  const actionsDisabled = !editable || busyUpload || resource.loading ||
    association.pending || association.uncertain || cleanup.pending || cleanup.uncertain

  function reload() {
    setRevisionDraft(null)
    resource.reload()
    changed()
  }

  const existingItems = useMemo(() => {
    const items = media?.items || []
    return items.map((asset) => {
      const isCover = media?.effectiveAssetId === asset.id
      const access = accessUrls[asset.id]
      const failed = asset.state === 'failed'
      const ready = asset.state === 'ready'
      return {
        id: asset.id,
        assetId: asset.id,
        name: asset.filename || `Image ${asset.id.slice(-6)}`,
        size: asset.size ?? 0,
        type: asset.type || '',
        version: asset.version,
        sha256: asset.sha256,
        status: ready ? 'uploaded' : failed ? 'failed' : 'pending',
        progress: ready ? 100 : 0,
        previewUrl: access?.href,
        remote: true,
        isCover,
        inherited: isCover && Boolean(variantId) && media.source === 'primary',
        canRemove: editable && isCover && (!variantId || media.source === 'variant'),
        actionsDisabled,
        removeLabel: variantId ? 'Clear override' : 'Clear cover',
        error: failed
          ? 'Processing failed. Upload a new file to replace it.'
          : undefined,
      }
    })
  }, [accessUrls, media, variantId, actionsDisabled, editable])

  const uploadFile = useCallback(
    async (file, { signal, onProgress }) => {
      setIntentError(null)
      let bytes
      try {
        bytes = await file.arrayBuffer()
      } catch {
        throw new Error('The image could not be read. Select it again.')
      }
      const hash = await sha256Hex(bytes)
      const cacheKey = `${hash}:${file.type}`
      let assetId = reserved.current.get(cacheKey)

      if (!assetId) {
        try {
          const data = await mutate('post', `${path}/media/intents`, {
            expectedRevision: revision,
            sha256: hash,
            type: file.type,
          })
          assetId = data.id
          reserved.current.set(cacheKey, assetId)
        } catch (failure) {
          setIntentError(failure)
          throw new Error(
            failure?.message ||
              'Could not reserve an upload slot. Please try again.',
            { cause: failure },
          )
        }
      }

      try {
        await uploadBytes(
          `${path}/media/${assetId}/content`,
          bytes,
          file.type,
          signal,
          onProgress,
        )
      } catch (failure) {
        if (signal.aborted) throw failure
        // Keep reserved asset id so Retry reuses the same PUT target + bytes.
        throw new Error(
          failure?.message || 'Upload failed. Please try again.',
          { cause: failure },
        )
      }
      reserved.current.delete(cacheKey)
      return { assetId }
    },
    [path, revision],
  )

  async function associate(assetId) {
    if (actionsDisabled) return
    setIntentError(null)
    if (
      await association.run('post', `${path}/media/association`, {
        expectedRevision: revision,
        assetId,
        ...(variantId ? { variantId } : {}),
      })
    ) {
      reload()
    }
  }

  async function removeRemote(item) {
    if (actionsDisabled || !item.canRemove) return
    const ok = await askConfirm({
      title: variantId ? 'Clear variant override?' : 'Clear cover image?',
      message: variantId
        ? 'Clear this variant override and inherit the product cover? The image stays in the library.'
        : 'Clear the cover image for this product? The image stays in the library.',
      confirmLabel: 'Clear',
      cancelLabel: 'Cancel',
      tone: 'danger',
    })
    if (!ok) return
    await associate(null)
  }

  function finishCleanup(data) {
    const removed = data?.removed ?? 0
    setCleanupResult(data
      ? `${removed} image${removed === 1 ? '' : 's'} removed. ${data.failed ?? 0} could not be removed. Images still in use or awaiting expiry are retained.`
      : 'Cleanup completed. Images still in use or awaiting expiry are retained.')
    resource.reload()
  }

  const mediaDisabled = resource.error?.code === 'MEDIA_DISABLED'

  return (
    <div className="product-media">
      <div className="section-heading">
        <h2>Catalog images</h2>
        <Action variant="secondary" onClick={() => resource.reload()}>
          Refresh images
        </Action>
      </div>

      <p className="product-media-lead">
        Add clear photos. Use <strong>Set as cover</strong> for the primary
        catalog image. Variants inherit the product cover until you set an
        override.
      </p>
      <p className="muted product-media-tips">
        JPG, PNG or WebP · max 10 MB · longest edge resized to 2048 px · prefer
        a white background.
      </p>

      <ErrorNotice error={resource.error} retry={resource.reload} />
      {mediaDisabled && (
        <p className="notice">
          Private image storage is not enabled for this environment. Upload
          actions are hidden.
        </p>
      )}
      <ErrorNotice
        error={intentError || association.error || cleanup.error}
      />
      <MutationRetry mutation={association} saved={reload} />
      <MutationRetry mutation={cleanup} saved={finishCleanup} />
      <ConflictReview
        error={intentError}
        path={path}
        values={{ revision }}
        onReview={(current) => {
          setRevisionDraft(current.revision)
          setIntentError(null)
        }}
      />

      {resource.loading && !media ? (
        <div className="product-media-skeleton" aria-busy="true">
          <Loading />
          <div className="product-media-skeleton-card" />
          <div className="product-media-skeleton-card" />
          <div className="product-media-skeleton-card" />
        </div>
      ) : null}

      {media && !mediaDisabled ? (
        <>
          <p className="product-media-source">
            Image source: {sourceLabel(media.source)}
          </p>

          <MultipleUploader
            filePlaceholder={IMAGE_PLACEHOLDER}
            maxSizeMB={MAX_SIZE_MB}
            maxFiles={MAX_FILES}
            disabled={!editable || association.pending || association.uncertain || cleanup.pending || cleanup.uncertain}
            ListComponent={ProductImageList}
            PreviewContent={ProductImagePreviewContent}
            listToolbar={
              <div className="product-image-target">
                <VariantSelect path={path} label="Image target" value={variantId} change={setVariant} />
              </div>
            }
            existing={existingItems}
            uploadFile={editable ? uploadFile : undefined}
            onBusyChange={setBusyUpload}
            onUploaded={reload}
            onSetCover={
              editable
                ? (item) => {
                    if (item.assetId) void associate(item.assetId)
                  }
                : undefined
            }
            onRemove={editable ? removeRemote : undefined}
          />

          {editable && (
            <div className="product-media-cleanup">
              <p className="muted">Cleanup removes expired images that are no longer in use. Clearing a cover keeps the image in the library until it is eligible for cleanup.</p>
              <Button
                variant="secondary"
                disabled={actionsDisabled}
                onClick={async () => {
                  const ok = await askConfirm({
                    title: 'Clean up unused images?',
                    message:
                      'Remove expired, unreferenced images from this product library? Images still used as product or variant covers, or in issued documents, are retained.',
                    confirmLabel: 'Clean up',
                    cancelLabel: 'Cancel',
                  })
                  if (!ok) return
                  setCleanupResult('')
                  const result = await cleanup.run('post', `${path}/media/cleanup`, {})
                  if (result) finishCleanup(result.data)
                }}
              >
                {cleanup.pending ? 'Cleaning up…' : 'Clean up unused images'}
              </Button>
            </div>
          )}
          {cleanupResult && <p className="notice" role="status">{cleanupResult}</p>}
        </>
      ) : null}
    </div>
  )
}
