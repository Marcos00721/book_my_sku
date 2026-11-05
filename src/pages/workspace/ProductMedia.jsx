import { useEffect, useRef, useState } from 'react'
import { useWorkspace } from '../../hooks/WorkspaceContext'
import { useResource } from '../../hooks/useResource'
import { useMutation } from '../../hooks/useMutation'
import { readData, queryPath } from '../../services/workspace'
import { uploadBytes } from '../../services/api'
import {
  Action,
  Empty,
  ErrorNotice,
  Loading,
} from '../../components/workspace/Elements'
import { VariantSelect } from '../../components/workspace/VariantSelect'
import {
  ConflictReview,
  MutationRetry,
} from '../../components/workspace/RecordTools'
import { useDraftGuard } from '../../hooks/useDraftGuard'

export function ProductMedia({ path, product, changed }) {
  const workspace = useWorkspace()
  const [variantId, setVariant] = useState('')
  const resource = useResource(queryPath(`${path}/media`, { variantId }))
  const [upload, setUpload] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState(null)
  const mounted = useRef(true)
  const active = useRef(null)
  const previewRequest = useRef(0)
  const uploadLocked = useRef(false)
  const association = useMutation()
  const intent = useMutation()
  const editable =
    workspace.can('products.edit') &&
    workspace.writesAllowed &&
    product.status !== 'archived'
  useDraftGuard(Boolean(upload))
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      active.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (!preview) return
    const timer = setTimeout(
      () => setPreview(null),
      Math.max(0, preview.ttl * 1000),
    )
    return () => clearTimeout(timer)
  }, [preview])
  function reload() {
    resource.reload()
    changed()
  }
  async function uploadFile() {
    if (!upload || busy || !editable || uploadLocked.current) return
    uploadLocked.current = true
    setBusy(true)
    setError(null)
    try {
      let assetId = upload.assetId
      if (!assetId) {
        const result = await intent.run('post', `${path}/media/intents`, {
          expectedRevision: upload.revision,
          sha256: upload.hash,
          type: upload.type,
        })
        if (!result) {
          setBusy(false)
          return
        }
        assetId = result.data.id
        if (!mounted.current) return
        setUpload((current) => ({ ...current, assetId }))
      }
      const controller = new AbortController()
      active.current = controller
      await uploadBytes(
        `${path}/media/${assetId}/content`,
        upload.bytes,
        upload.type,
        controller.signal,
      )
      if (mounted.current) {
        setUpload(null)
        reload()
      }
    } catch (failure) {
      if (mounted.current) setError(failure)
    } finally {
      uploadLocked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function chooseFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setError(null)
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError(new Error('Choose a JPEG, PNG or WebP image.'))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(new Error('Choose an image no larger than 10 MiB.'))
      return
    }
    try {
      const bytes = await file.arrayBuffer()
      const hash = [
        ...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      ]
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('')
      if (mounted.current)
        setUpload({
          bytes,
          hash,
          type: file.type,
          name: file.name,
          revision: resource.data?.revision ?? product.revision,
          assetId: null,
        })
    } catch {
      if (mounted.current)
        setError(new Error('The image could not be read. Select it again.'))
    }
  }
  async function associate(assetId) {
    if (!editable) return
    if (
      await association.run('post', `${path}/media/association`, {
        expectedRevision: resource.data.revision,
        assetId,
        ...(variantId ? { variantId } : {}),
      })
    ) {
      setPreview(null)
      reload()
    }
  }
  async function display(assetId) {
    const request = ++previewRequest.current
    setError(null)
    try {
      const result = await readData(`${path}/media/${assetId}/access`)
      const url = new URL(result.url)
      if (url.protocol !== 'https:' || url.username || url.password)
        throw new Error('The private image link could not be verified.')
      if (mounted.current && request === previewRequest.current)
        setPreview({
          id: assetId,
          url: url.href,
          ttl: Math.min(300, Number(result.expiresInSeconds) || 300),
        })
    } catch (failure) {
      if (mounted.current && request === previewRequest.current)
        setError(failure)
    }
  }
  return (
    <>
      <div className="section-heading">
        <h2>Catalog images</h2>
        <Action
          variant="secondary"
          onClick={() => {
            previewRequest.current++
            setPreview(null)
            resource.reload()
          }}
        >
          Refresh images
        </Action>
      </div>
      <p>
        Private catalog images can be selected for the product or override a
        variant. Variants inherit the primary image when their override is
        cleared.
      </p>
      <VariantSelect
        path={path}
        label="Image target"
        value={variantId}
        change={(value) => {
          previewRequest.current++
          setVariant(value)
          setPreview(null)
        }}
      />
      <ErrorNotice error={resource.error} retry={resource.reload} />
      {resource.error?.code === 'MEDIA_DISABLED' && (
        <p className="notice">
          Private image storage is not enabled for this environment.
        </p>
      )}
      <ErrorNotice error={error || intent.error || association.error} />
      {error && upload?.assetId && (
        <p className="notice">
          The upload outcome is uncertain. Refresh the image list or retry this
          same reserved asset and file.
        </p>
      )}
      <MutationRetry mutation={association} saved={reload} />
      {resource.loading ? (
        <Loading />
      ) : (
        resource.data && (
          <>
            <p>
              Image source: {resource.data.source || 'None'} · Selected asset:{' '}
              {resource.data.effectiveAssetId || 'None'}
            </p>
            {editable &&
              resource.data.effectiveAssetId &&
              (!variantId || resource.data.source === 'variant') && (
                <Action
                  variant="secondary"
                  disabled={association.pending || association.uncertain}
                  onClick={() => associate(null)}
                >
                  {variantId
                    ? 'Clear override and inherit primary'
                    : 'Clear primary image'}
                </Action>
              )}
            {resource.data.items?.length ? (
              <div className="catalog-image-grid">
                {resource.data.items.map((asset) => (
                  <article className="address-card" key={asset.id}>
                    <strong>Image {asset.id}</strong>
                    <p>{asset.state}</p>
                    {asset.state === 'ready' && (
                      <div className="actions">
                        <Action
                          variant="secondary"
                          onClick={() => display(asset.id)}
                        >
                          View private image
                        </Action>
                        {editable && (
                          <Action
                            disabled={
                              association.pending || association.uncertain
                            }
                            onClick={() => associate(asset.id)}
                          >
                            Use for selected target
                          </Action>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <Empty title="No catalog images">
                Upload a product photograph to start this private image library.
              </Empty>
            )}
          </>
        )
      )}
      {preview && (
        <figure className="catalog-preview">
          <img
            src={preview.url}
            alt={`${product.name}${variantId ? ' variant' : ''} catalog image`}
            referrerPolicy="no-referrer"
            onError={() => setPreview(null)}
          />
          <figcaption>
            This private display link expires automatically. Refresh it when
            needed.
          </figcaption>
        </figure>
      )}
      {editable && !resource.error && (
        <section className="panel">
          <label className="field">
            Choose catalog image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy || Boolean(upload)}
              onChange={chooseFile}
            />
          </label>
          {upload && (
            <>
              <p>Selected: {upload.name}</p>
              {!upload.assetId && (
                <ConflictReview
                  error={intent.error}
                  path={path}
                  values={{ revision: upload.revision }}
                  onReview={(current) =>
                    setUpload((previous) => ({
                      ...previous,
                      revision: current.revision,
                    }))
                  }
                />
              )}
              <div className="actions">
                <Action disabled={busy} onClick={uploadFile}>
                  {busy
                    ? 'Uploading…'
                    : upload.assetId || intent.uncertain
                      ? 'Retry same image upload'
                      : 'Upload catalog image'}
                </Action>
                {((!upload.assetId && !intent.uncertain) ||
                  (upload.assetId &&
                    [
                      'UPLOAD_EXPIRED',
                      'INVALID_RASTER',
                      'IMAGE_TYPE_MISMATCH',
                      'IMAGE_TOO_LARGE',
                    ].includes(error?.code))) && (
                  <Action
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setUpload(null)}
                  >
                    Discard file selection
                  </Action>
                )}
              </div>
            </>
          )}
          <p className="muted">
            The server validates and sanitizes the original image. Uploading
            does not select it automatically.
          </p>
        </section>
      )}
    </>
  )
}
