import { useCallback, useEffect, useRef, useState } from 'react'
import { validateFiles } from './validateFile'
import type {
  FilePlaceholder,
  UploadFileFn,
  UploadFileItem,
} from './types'

let nextId = 0
function createLocalId() {
  nextId += 1
  return `local-${Date.now()}-${nextId}`
}

export interface UseFileUploadOptions {
  filePlaceholder: FilePlaceholder
  maxSizeMB: number
  maxFiles?: number
  multiple?: boolean
  disabled?: boolean
  /** When set, files upload immediately after a valid pick. */
  uploadFile?: UploadFileFn
  /** Seed / merge remote (already uploaded) items. */
  existing?: UploadFileItem[]
}

export function useFileUpload({
  filePlaceholder,
  maxSizeMB,
  maxFiles,
  multiple = true,
  disabled = false,
  uploadFile,
  existing = [],
}: UseFileUploadOptions) {
  const [localItems, setLocalItems] = useState<UploadFileItem[]>([])
  const [batchError, setBatchError] = useState<string | null>(null)
  const controllers = useRef(new Map<string, AbortController>())
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      for (const controller of controllers.current.values()) {
        controller.abort()
      }
      controllers.current.clear()
      setLocalItems((items) => {
        for (const item of items) {
          if (item.previewUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(item.previewUrl)
          }
        }
        return items
      })
    }
  }, [])

  const items: UploadFileItem[] = [
    ...existing,
    ...localItems.filter(
      (local) =>
        !existing.some(
          (remote) =>
            remote.assetId &&
            local.assetId &&
            remote.assetId === local.assetId,
        ),
    ),
  ]

  const busy = localItems.some(
    (item) => item.status === 'pending' || item.status === 'uploading',
  )

  const patchLocal = useCallback(
    (id: string, patch: Partial<UploadFileItem>) => {
      setLocalItems((list) =>
        list.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      )
    },
    [],
  )

  const runUpload = useCallback(
    async (item: UploadFileItem) => {
      if (!uploadFile || !item.file || disabled) return
      const controller = new AbortController()
      controllers.current.set(item.id, controller)
      patchLocal(item.id, {
        status: 'uploading',
        progress: 0,
        error: undefined,
      })
      try {
        const result = await uploadFile(item.file, {
          signal: controller.signal,
          onProgress: (percent) => {
            if (mounted.current) patchLocal(item.id, { progress: percent })
          },
        })
        if (!mounted.current) return
        patchLocal(item.id, {
          status: 'uploaded',
          progress: 100,
          assetId: result?.assetId,
          previewUrl: result?.previewUrl ?? item.previewUrl,
          error: undefined,
        })
      } catch (failure) {
        if (!mounted.current || controller.signal.aborted) return
        const message =
          failure instanceof Error && failure.message
            ? failure.message
            : 'Upload failed. Please try again.'
        patchLocal(item.id, {
          status: 'failed',
          error: message,
        })
      } finally {
        controllers.current.delete(item.id)
      }
    },
    [disabled, patchLocal, uploadFile],
  )

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      if (disabled) return
      setBatchError(null)
      const incoming = Array.from(fileList)
      const limited = multiple ? incoming : incoming.slice(0, 1)
      const currentCount = existing.length + localItems.length
      const { valid, errors } = validateFiles(limited, {
        placeholder: filePlaceholder,
        maxSizeMB,
        maxFiles: multiple ? maxFiles : 1,
        currentCount: multiple ? currentCount : 0,
        existing: [...existing, ...localItems],
      })

      if (errors.length) setBatchError(errors.join(' '))

      if (!valid.length) return

      // Single mode replaces the previous local file.
      if (!multiple) {
        setLocalItems((prev) => {
          for (const item of prev) {
            controllers.current.get(item.id)?.abort()
            if (item.previewUrl?.startsWith('blob:')) {
              URL.revokeObjectURL(item.previewUrl)
            }
          }
          return []
        })
      }

      const created: UploadFileItem[] = valid.map((file) => ({
        id: createLocalId(),
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'pending' as const,
        progress: 0,
        file,
        previewUrl: URL.createObjectURL(file),
      }))

      setLocalItems((prev) => (multiple ? [...prev, ...created] : created))

      if (uploadFile) {
        queueMicrotask(() => {
          for (const item of created) void runUpload(item)
        })
      }
    },
    [
      disabled,
      existing,
      filePlaceholder,
      localItems,
      maxFiles,
      maxSizeMB,
      multiple,
      runUpload,
      uploadFile,
    ],
  )

  const removeLocal = useCallback((id: string) => {
    controllers.current.get(id)?.abort()
    controllers.current.delete(id)
    setLocalItems((list) => {
      const target = list.find((item) => item.id === id)
      if (target?.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(target.previewUrl)
      }
      return list.filter((item) => item.id !== id)
    })
  }, [])

  const retry = useCallback(
    (id: string) => {
      const item = localItems.find((entry) => entry.id === id)
      if (item) void runUpload(item)
    },
    [localItems, runUpload],
  )

  const cancel = useCallback((id: string) => {
    controllers.current.get(id)?.abort()
    controllers.current.delete(id)
    patchLocal(id, {
      status: 'failed',
      error: 'Upload cancelled.',
    })
  }, [patchLocal])

  const clearUploadedLocals = useCallback(() => {
    setLocalItems((list) => {
      const keep: UploadFileItem[] = []
      for (const item of list) {
        if (item.status === 'uploaded') {
          if (item.previewUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(item.previewUrl)
          }
        } else {
          keep.push(item)
        }
      }
      return keep
    })
  }, [])

  return {
    items,
    localItems,
    batchError,
    setBatchError,
    busy,
    addFiles,
    removeLocal,
    retry,
    cancel,
    clearUploadedLocals,
  }
}
