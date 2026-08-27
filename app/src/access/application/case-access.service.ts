import { Inject, Injectable } from '@nestjs/common';
import { UserRoleEnum } from '../../identity-access/domain/user/value-objects/user-role.vo';
import { CaseAccessDeniedError } from './case-access-denied.error';
import {
  CASE_ACCESS_READER,
  type CaseAccessReader,
  type CaseScopeTarget,
  type CaseTitle,
} from './case-access.reader';

export interface CaseRequester {
  id: string;
  role: UserRoleEnum;
}

export type AccessTitle = 'SERVICE_MANAGER' | CaseTitle;

export interface GrantedCaseAccess {
  caseId: string;
  title: AccessTitle;
}

@Injectable()
export class CaseAccessService {
  constructor(
    @Inject(CASE_ACCESS_READER)
    private readonly caseAccessReader: CaseAccessReader,
  ) {}

  /** `null` quand le jeton n'a pas de compte dans le service : personne, donc
   * aucun accès. */
  async assertAccessToCase(
    requester: CaseRequester | null,
    caseId: string,
  ): Promise<AccessTitle> {
    const target: CaseScopeTarget = { kind: 'CASE', id: caseId };
    if (requester === null) {
      throw new CaseAccessDeniedError(target);
    }
    const granted = await this.assertAccessTo(requester, target);
    return granted.title;
  }

  async assertAccessTo(
    requester: CaseRequester,
    target: CaseScopeTarget,
  ): Promise<GrantedCaseAccess> {
    const caseId = await this.caseIdOf(target);
    if (caseId === null) {
      throw new CaseAccessDeniedError(target);
    }

    if (requester.role === UserRoleEnum.ADMIN) {
      return { caseId, title: 'SERVICE_MANAGER' };
    }

    const title = await this.caseAccessReader.findTitle(requester.id, caseId);
    if (title === null) {
      throw new CaseAccessDeniedError(target);
    }
    return { caseId, title };
  }

  visibleCaseIds(requester: CaseRequester): Promise<string[] | null> {
    if (requester.role === UserRoleEnum.ADMIN) {
      return Promise.resolve(null);
    }
    return this.caseAccessReader.findCaseIdsOf(requester.id);
  }

  private caseIdOf(target: CaseScopeTarget): Promise<string | null> {
    if (target.kind === 'CASE') {
      return Promise.resolve(target.id);
    }
    return this.caseAccessReader.findCaseIdOfResource(target.kind, target.id);
  }
}
