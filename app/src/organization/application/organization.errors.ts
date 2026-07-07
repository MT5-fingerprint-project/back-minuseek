export class InvalidOrganizationSlugError extends Error {
  constructor(slug: string) {
    super(`Invalid organization slug: ${slug}`);
  }
}

export class OrganizationAlreadyExistsError extends Error {
  constructor(slug: string) {
    super(`Organization already exists: ${slug}`);
  }
}

export class OrganizationNotFoundError extends Error {
  constructor(slug: string) {
    super(`Organization not found: ${slug}`);
  }
}
