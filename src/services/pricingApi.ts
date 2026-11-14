import { api } from './api'
import { queryPath } from './workspace'
import type {
  PricingPreviewLine,
  PricingPreviewResult,
  PricingScheduleKind,
} from '../types/pricing'

export const pricingPaths = {
  schedules: (
    productPath: string,
    kind?: PricingScheduleKind,
    after?: string,
  ) =>
    queryPath(`${productPath}/pricing/schedules`, {
      kind,
      limit: 25,
      after,
    }),
  preview: (productPath: string) => `${productPath}/pricing/preview`,
  adoptionPreview: (productPath: string) =>
    `${productPath}/pricing/adoption-preview`,
  adoptions: (productPath: string) => `${productPath}/pricing/adoptions`,
}

export async function previewPricing(
  productPath: string,
  body: {
    accountId: string
    warehouseId: string
    agreementId: string
    asOf: string
    versionId?: string
    lines: PricingPreviewLine[]
    expected?: Record<string, string | number>
  },
): Promise<PricingPreviewResult> {
  const response = await api.post(pricingPaths.preview(productPath), body)
  return response.data as PricingPreviewResult
}

export async function previewPricingAdoption(
  productPath: string,
  versions: string[],
) {
  const response = await api.post(pricingPaths.adoptionPreview(productPath), {
    versions,
  })
  return response.data
}
