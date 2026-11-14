/** Manual goods pricing types — match PRODUCT-04 schedule API. */

export type MoneyRate = string | null

export type PricingScheduleKind = 'draft' | 'published'

export type PricingPreviewLine = {
  id: string
  variantId: string
  demandEach: number
  pool: boolean
}

export type PricingPreviewResult = {
  currency: string
  saleComplete?: boolean
  goodsSale?: MoneyRate | { numerator: number; denominator: number }
  knownSale?: MoneyRate | { numerator: number; denominator: number }
  costComplete?: boolean
  knownCost?: MoneyRate | { numerator: number; denominator: number }
  goodsCost?: MoneyRate | { numerator: number; denominator: number }
  goodsProfit?: MoneyRate | { numerator: number; denominator: number }
  margin?: MoneyRate | { numerator: number; denominator: number }
  firmTotal?: MoneyRate
  firmBlockers?: string[]
  sources?: Record<string, string | number>
  components?: Array<{
    lineId: string
    variantId?: string
    demandEach?: number
    sale?: MoneyRate
    cost?: MoneyRate
    unknowns?: string[]
  }>
}
