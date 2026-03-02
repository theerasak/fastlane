export class ApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string = 'ERROR') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(message, 401, 'UNAUTHORIZED')
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(message, 403, 'FORBIDDEN')
  }

  static notFound(message = 'Not found') {
    return new ApiError(message, 404, 'NOT_FOUND')
  }

  static conflict(message = 'Conflict') {
    return new ApiError(message, 409, 'CONFLICT')
  }

  static badRequest(message = 'Bad request') {
    return new ApiError(message, 400, 'BAD_REQUEST')
  }

  static internal(message = 'Internal server error') {
    return new ApiError(message, 500, 'INTERNAL_ERROR')
  }
}

export function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    return { error: err.message, code: err.code, status: err.status }
  }
  console.error('Unexpected error:', err)
  return { error: 'Internal server error', code: 'INTERNAL_ERROR', status: 500 }
}
