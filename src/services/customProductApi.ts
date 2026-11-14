import { queryPath, readData } from './workspace'
import type {
  CustomProduct,
  CustomProductListResponse,
  CustomProductVariant,
} from '../types/customProduct'

export const customProductPaths = {
  collection: (base: string) => `${base}/products`,
  detail: (base: string, id: string) =>
    `${base}/products/${encodeURIComponent(id)}`,
  archive: (base: string, id: string) =>
    `${customProductPaths.detail(base, id)}/archive`,
  restore: (base: string, id: string) =>
    `${customProductPaths.detail(base, id)}/restore`,
  copy: (base: string, id: string) =>
    `${customProductPaths.detail(base, id)}/copy`,
  activity: (base: string, id: string) =>
    `${customProductPaths.detail(base, id)}/activity`,
  supplierOptions: (base: string) =>
    `${customProductPaths.collection(base)}/supplier-options`,
  categoryOptions: (base: string) =>
    `${customProductPaths.collection(base)}/category-options`,
}

export async function fetchAllCustomProducts(
  base: string,
  signal?: AbortSignal,
): Promise<CustomProduct[]> {
  const products: CustomProduct[] = []
  let after: string | undefined
  do {
    const data = (await readData(
      queryPath(customProductPaths.collection(base), {
        status: 'all',
        limit: 50,
        after,
      }),
      { signal },
    )) as CustomProductListResponse
    products.push(...(data.items || []))
    after = data.next || undefined
  } while (after)
  return products
}

/** Resolve the actual variant for a conflict review, including later pages. */
export async function getCustomProductVariant(
  productPath: string,
  variantId: string,
  signal?: AbortSignal,
): Promise<CustomProductVariant | null> {
  let after: string | undefined
  do {
    const page = (await readData(
      queryPath(`${productPath}/variants`, {
        status: 'all',
        limit: 50,
        after,
      }),
      { signal },
    )) as { items: CustomProductVariant[]; next: string | null }
    const variant = page.items.find((item) => item.id === variantId)
    if (variant) return variant
    after = page.next || undefined
  } while (after)
  return null
}
