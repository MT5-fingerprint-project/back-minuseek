import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserReadModel } from '../../application/queries/get-user-by-provider-id/user-read-model';
import { RequestWithCurrentUser } from './current-user.guard';

/** Le compte du service de l'appelant, posé par CurrentUserGuard. Absent quand
 * le jeton n'a pas encore de ligne en base. */
export const CurrentServiceUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserReadModel | undefined =>
    ctx.switchToHttp().getRequest<RequestWithCurrentUser>().currentUser,
);
