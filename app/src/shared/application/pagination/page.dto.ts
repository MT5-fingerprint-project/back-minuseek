export interface PaginationOptions {
  page: number;
  limit: number;
}

export class PageDto<T> {
  readonly data: T[];
  readonly meta: {
    page: number;
    limit: number;
    itemCount: number;
    pageCount: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };

  constructor(
    data: T[],
    meta: { itemCount: number; paginationOptions: PaginationOptions },
  ) {
    const pageCount = Math.ceil(meta.itemCount / meta.paginationOptions.limit);
    this.data = data;
    this.meta = {
      page: meta.paginationOptions.page,
      limit: meta.paginationOptions.limit,
      itemCount: meta.itemCount,
      pageCount,
      hasPreviousPage: meta.paginationOptions.page > 1,
      hasNextPage: meta.paginationOptions.page < pageCount,
    };
  }
}
