export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
  meta?: { total?: number; page?: number; limit?: number }
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: { total: number; page: number; limit: number }
}
