import { AuditActor, AuditActorTypeEnum } from './audit-actor.vo';

describe('AuditActor', () => {
  const investigator = {
    sub: 'a1b2c3',
    username: 'mdupont',
    displayName: 'Marie Dupont',
  };

  it('snapshots the identity of a human actor', () => {
    expect(AuditActor.user(investigator).toPrimitives()).toEqual({
      type: AuditActorTypeEnum.USER,
      ...investigator,
    });
  });

  it.each(['sub', 'username', 'displayName'])(
    'rejects a user actor with a blank %s',
    (field) => {
      expect(() =>
        AuditActor.user({ ...investigator, [field]: '   ' }),
      ).toThrow();
    },
  );

  it('fills every field of a system actor so its serialized shape never varies', () => {
    expect(AuditActor.system('provisioner').toPrimitives()).toEqual({
      type: AuditActorTypeEnum.SYSTEM,
      sub: 'system:provisioner',
      username: 'provisioner',
      displayName: 'provisioner',
    });
  });

  it('flags system actors', () => {
    expect(AuditActor.system('anchor-cron').isSystem()).toBe(true);
    expect(AuditActor.user(investigator).isSystem()).toBe(false);
  });

  it('rejects a system actor without a name', () => {
    expect(() => AuditActor.system('')).toThrow();
  });

  it('trims surrounding whitespace', () => {
    expect(
      AuditActor.user({
        sub: '  a1b2c3  ',
        username: ' mdupont ',
        displayName: ' Marie Dupont ',
      }).toPrimitives(),
    ).toEqual({ type: AuditActorTypeEnum.USER, ...investigator });
  });

  it('rebuilds an actor from its stored snapshot', () => {
    const stored = AuditActor.user(investigator).toPrimitives();

    expect(
      AuditActor.reconstitute(stored).equals(AuditActor.user(investigator)),
    ).toBe(true);
  });

  it('rejects a stored snapshot with an unknown actor type', () => {
    expect(() =>
      AuditActor.reconstitute({
        ...investigator,
        type: 'ROBOT' as AuditActorTypeEnum,
      }),
    ).toThrow();
  });

  it('compares by value', () => {
    expect(
      AuditActor.user(investigator).equals(AuditActor.user(investigator)),
    ).toBe(true);
    expect(
      AuditActor.user(investigator).equals(
        AuditActor.user({ ...investigator, displayName: 'Marie D.' }),
      ),
    ).toBe(false);
  });
});
