import {
  InvestigationCaseStatus,
  InvestigationCaseStatusEnum,
} from '../value-objects/investigation-case-status.vo';
import { CaseClosedError } from '../errors/case-closed.error';
import { InvalidCaseTransitionError } from '../errors/invalid-case-transition.error';
import { InvalidOffensePeriodError } from '../errors/invalid-offense-period.error';

interface OpenInvestigationCaseProps {
  id: string;
  caseNumber: string;
  pvNumber: string;
  description?: string;
  operatorUserId: string;
}

/** Les informations administratives de la procédure. Toutes facultatives : une
 * affaire s'ouvre avec ce qu'on sait et se complète ensuite. */
export interface CaseJudicialHeader {
  requestDate: Date | null;
  requesterQuality: string | null;
  requesterName: string | null;
  requesterService: string | null;
  offenseNature: string | null;
  offenseLocation: string | null;
  offenseDateFrom: Date | null;
  offenseDateTo: Date | null;
  interventionDate: Date | null;
  caseAgainst: string | null;
}

export const JUDICIAL_HEADER_FIELDS = [
  'requestDate',
  'requesterQuality',
  'requesterName',
  'requesterService',
  'offenseNature',
  'offenseLocation',
  'offenseDateFrom',
  'offenseDateTo',
  'interventionDate',
  'caseAgainst',
] as const satisfies readonly (keyof CaseJudicialHeader)[];

export const NO_JUDICIAL_HEADER: CaseJudicialHeader = {
  requestDate: null,
  requesterQuality: null,
  requesterName: null,
  requesterService: null,
  offenseNature: null,
  offenseLocation: null,
  offenseDateFrom: null,
  offenseDateTo: null,
  interventionDate: null,
  caseAgainst: null,
};

/** Ce que le dossier porte du destinataire : une copie des trois lignes, jamais
 * une référence au carnet — retirer une fiche du carnet ne réécrit aucun
 * dossier déjà adressé. */
export interface CaseRecipient {
  recipientAuthority: string | null;
  recipientAttentionQuality: string | null;
  recipientAttentionName: string | null;
}

export const NO_RECIPIENT: CaseRecipient = {
  recipientAuthority: null,
  recipientAttentionQuality: null,
  recipientAttentionName: null,
};

/** Les trois lignes telles que la route les reçoit : un bloc, remplacé en
 * entier. */
export interface StatedRecipient {
  authority?: string | null;
  attentionQuality?: string | null;
  attentionName?: string | null;
}

export interface CaseCorrection extends Partial<CaseJudicialHeader> {
  pvNumber?: string;
  description?: string | null;
}

export interface InvestigationCasePrimitives
  extends CaseJudicialHeader, CaseRecipient {
  id: string;
  caseNumber: string;
  pvNumber: string;
  description: string | null;
  status: string;
  operatorUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Un champ absent n'est pas touché ; un champ à `null` est vidé. */
function statedOr<T>(sent: T | null | undefined, current: T | null): T | null {
  return sent === undefined ? current : sent;
}

export class InvestigationCase {
  private constructor(
    private readonly _id: string,
    private readonly _caseNumber: string,
    private _pvNumber: string,
    private _description: string | undefined,
    private _status: InvestigationCaseStatus,
    private _operatorUserId: string | null,
    private _judicialHeader: CaseJudicialHeader,
    private _recipient: CaseRecipient,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {}

  static open(props: OpenInvestigationCaseProps): InvestigationCase {
    const now = new Date();
    return new InvestigationCase(
      props.id,
      props.caseNumber,
      props.pvNumber,
      props.description,
      InvestigationCaseStatus.open(),
      props.operatorUserId,
      { ...NO_JUDICIAL_HEADER },
      { ...NO_RECIPIENT },
      now,
      now,
    );
  }

  static reconstitute(
    primitives: InvestigationCasePrimitives,
  ): InvestigationCase {
    return new InvestigationCase(
      primitives.id,
      primitives.caseNumber,
      primitives.pvNumber,
      primitives.description ?? undefined,
      InvestigationCaseStatus.from(primitives.status),
      primitives.operatorUserId,
      {
        requestDate: primitives.requestDate,
        requesterQuality: primitives.requesterQuality,
        requesterName: primitives.requesterName,
        requesterService: primitives.requesterService,
        offenseNature: primitives.offenseNature,
        offenseLocation: primitives.offenseLocation,
        offenseDateFrom: primitives.offenseDateFrom,
        offenseDateTo: primitives.offenseDateTo,
        interventionDate: primitives.interventionDate,
        caseAgainst: primitives.caseAgainst,
      },
      {
        recipientAuthority: primitives.recipientAuthority,
        recipientAttentionQuality: primitives.recipientAttentionQuality,
        recipientAttentionName: primitives.recipientAttentionName,
      },
      primitives.createdAt,
      primitives.updatedAt,
    );
  }

  correct(correction: CaseCorrection): void {
    if (this.status === InvestigationCaseStatusEnum.CLOSED) {
      throw new CaseClosedError(this._id);
    }
    // La période est jugée avant toute écriture : un refus ne laisse pas
    // derrière lui la moitié d'une correction.
    const judicialHeader = this.judicialHeaderStatedBy(correction);
    if (correction.pvNumber !== undefined) {
      this._pvNumber = correction.pvNumber;
    }
    if (correction.description !== undefined) {
      this._description = correction.description ?? undefined;
    }
    this._judicialHeader = judicialHeader;
    this._updatedAt = new Date();
  }

  /** Applique les champs judiciaires fournis et laisse les autres intacts : un
   * remplacement de bloc viderait ce que le formulaire ne renvoie pas. */
  private judicialHeaderStatedBy(
    correction: CaseCorrection,
  ): CaseJudicialHeader {
    const current = this._judicialHeader;
    const stated: CaseJudicialHeader = {
      requestDate: statedOr(correction.requestDate, current.requestDate),
      requesterQuality: statedOr(
        correction.requesterQuality,
        current.requesterQuality,
      ),
      requesterName: statedOr(correction.requesterName, current.requesterName),
      requesterService: statedOr(
        correction.requesterService,
        current.requesterService,
      ),
      offenseNature: statedOr(correction.offenseNature, current.offenseNature),
      offenseLocation: statedOr(
        correction.offenseLocation,
        current.offenseLocation,
      ),
      offenseDateFrom: statedOr(
        correction.offenseDateFrom,
        current.offenseDateFrom,
      ),
      offenseDateTo: statedOr(correction.offenseDateTo, current.offenseDateTo),
      interventionDate: statedOr(
        correction.interventionDate,
        current.interventionDate,
      ),
      caseAgainst: statedOr(correction.caseAgainst, current.caseAgainst),
    };

    const { offenseDateFrom, offenseDateTo } = stated;
    if (
      offenseDateTo !== null &&
      (offenseDateFrom === null ||
        offenseDateTo.getTime() < offenseDateFrom.getTime())
    ) {
      throw new InvalidOffensePeriodError();
    }
    return stated;
  }

  /** Le destinataire se remplace en bloc : le dialogue renvoie les trois lignes
   * ensemble, et ce qu'il n'a pas rempli n'est pas adressé. */
  replaceRecipient(stated: StatedRecipient): void {
    if (this.status === InvestigationCaseStatusEnum.CLOSED) {
      throw new CaseClosedError(this._id);
    }
    this._recipient = {
      recipientAuthority: stated.authority ?? null,
      recipientAttentionQuality: stated.attentionQuality ?? null,
      recipientAttentionName: stated.attentionName ?? null,
    };
    this._updatedAt = new Date();
  }

  close(): void {
    if (this._status.isClosed()) {
      throw new InvalidCaseTransitionError(
        this.status,
        InvestigationCaseStatusEnum.CLOSED,
      );
    }
    this._status = InvestigationCaseStatus.closed();
    this._updatedAt = new Date();
  }

  reopen(): void {
    if (!this._status.isClosed()) {
      throw new InvalidCaseTransitionError(
        this.status,
        InvestigationCaseStatusEnum.IN_PROGRESS,
      );
    }
    this._status = InvestigationCaseStatus.inProgress();
    this._updatedAt = new Date();
  }

  changeOperator(newOperatorUserId: string): void {
    if (this.status === InvestigationCaseStatusEnum.CLOSED) {
      throw new CaseClosedError(this._id);
    }
    this._operatorUserId = newOperatorUserId;
    this._updatedAt = new Date();
  }

  get id() {
    return this._id;
  }

  get caseNumber() {
    return this._caseNumber;
  }

  get pvNumber() {
    return this._pvNumber;
  }

  get description() {
    return this._description;
  }

  get status() {
    return this._status.getValue();
  }

  get operatorUserId() {
    return this._operatorUserId;
  }

  get createdAt() {
    return this._createdAt;
  }

  get updatedAt() {
    return this._updatedAt;
  }

  get judicialHeader(): CaseJudicialHeader {
    return { ...this._judicialHeader };
  }

  get recipient(): CaseRecipient {
    return { ...this._recipient };
  }
}
