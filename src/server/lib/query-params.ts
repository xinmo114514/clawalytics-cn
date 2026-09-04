import type { Request } from 'express'

export class QueryParameterError extends Error {}

export function parsePositiveSafeInteger(value: unknown, name: string): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new QueryParameterError(`${name} must be a positive integer`)
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new QueryParameterError(`${name} must be a positive integer`)
  }

  return parsed
}

export function parseBoundedInteger(
  value: unknown,
  name: string,
  min: number,
  max: number
): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new QueryParameterError(
      `${name} must be an integer between ${min} and ${max}`
    )
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new QueryParameterError(
      `${name} must be an integer between ${min} and ${max}`
    )
  }
  return parsed
}

export function validateBoundedQuery(
  req: Pick<Request, 'query'>,
  name: string,
  min: number,
  max: number
): void {
  const raw = req.query[name]
  if (raw === undefined) return
  if (Array.isArray(raw)) {
    throw new QueryParameterError(
      `${name} must be an integer between ${min} and ${max}`
    )
  }
  parseBoundedInteger(raw, name, min, max)
}
