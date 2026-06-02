import { PageDto } from './page.dto';

describe('PageDto', () => {
  it('calcule pageCount via Math.ceil', () => {
    const page = new PageDto([1, 2], {
      itemCount: 5,
      paginationOptions: { page: 1, limit: 2 },
    });
    expect(page.meta.pageCount).toBe(3);
  });

  it('hasPreviousPage est false sur la première page', () => {
    const page = new PageDto([], {
      itemCount: 10,
      paginationOptions: { page: 1, limit: 5 },
    });
    expect(page.meta.hasPreviousPage).toBe(false);
    expect(page.meta.hasNextPage).toBe(true);
  });

  it('hasNextPage est false sur la dernière page', () => {
    const page = new PageDto([], {
      itemCount: 10,
      paginationOptions: { page: 2, limit: 5 },
    });
    expect(page.meta.hasPreviousPage).toBe(true);
    expect(page.meta.hasNextPage).toBe(false);
  });

  it('expose les données passées', () => {
    const page = new PageDto(['a', 'b'], {
      itemCount: 2,
      paginationOptions: { page: 1, limit: 20 },
    });
    expect(page.data).toEqual(['a', 'b']);
  });
});
