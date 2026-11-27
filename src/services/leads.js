import { api, ApiError } from './api'

export function canAddLead(workspace) {
  return workspace.can('inquiries.add')
}

export const leadStages = {
  new: { label: 'New', tone: 'info' },
  reviewing: { label: 'Reviewing', tone: 'warning' },
  qualified: { label: 'Qualified', tone: 'success' },
  converted: { label: 'Converted', tone: 'primary' },
  closed: { label: 'Closed', tone: 'default' },
}

export const leadFields = {
  companyName: 'Company name', contactName: 'Contact name', email: 'Email address',
  phone: 'Phone', requestedInHandsDate: 'Requested in-hands date', requirement: 'Requirement',
}

export function acceptedLead(lead) {
  return Object.fromEntries(Object.keys(leadFields).map(key => [
    key, lead?.corrections?.[key] ?? lead?.submitted?.[key] ?? '',
  ]))
}

export function leadTransitions(stage) {
  return [
    ...(stage === 'new' ? [{ value: 'review', label: 'Start reviewing' }] : []),
    ...(stage === 'reviewing' ? [{ value: 'qualify', label: 'Mark qualified' }] : []),
    ...(stage === 'qualified' ? [{ value: 'return', label: 'Return to reviewing' }] : []),
    ...(['new', 'reviewing', 'qualified'].includes(stage) ? [{ value: 'close', label: 'Close lead' }] : []),
  ]
}

// This endpoint returns an array, unlike the other workspace list envelopes.
export async function readLeadActivity(path, options) {
  const response = await api.get(path, options)
  if (!Array.isArray(response?.data)) {
    throw new ApiError('The server returned an unexpected activity response.', { status: 502 })
  }
  return { items: response.data }
}
