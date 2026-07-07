import { SetMetadata } from '@nestjs/common';

export const SYSTEM_REALM_ONLY_KEY = 'systemRealmOnly';

export const SystemRealmOnly = () => SetMetadata(SYSTEM_REALM_ONLY_KEY, true);
