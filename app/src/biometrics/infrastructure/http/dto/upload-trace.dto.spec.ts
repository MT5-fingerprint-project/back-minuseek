import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { UploadTraceDto } from './upload-trace.dto';

const CASE_ID = '3f1b2c8e-0a4d-4f2b-9c6e-8d5a1b7c9e01';

const BODY: ArgumentMetadata = { type: 'body', metatype: UploadTraceDto };

// Le pipe exact posé sur le @Body() de POST /traces, appliqué à un corps
// multipart dont toutes les valeurs arrivent en chaîne de caractères.
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});

const transform = (body: Record<string, string>): Promise<UploadTraceDto> =>
  pipe.transform(body, BODY) as Promise<UploadTraceDto>;

const rejectionMessages = (body: Record<string, string>): Promise<string[]> =>
  transform(body).then(
    () => [],
    (error: BadRequestException) =>
      (error.getResponse() as { message: string[] }).message,
  );

const expectRejection = async (
  body: Record<string, string>,
  property: string,
): Promise<void> => {
  await expect(transform(body)).rejects.toBeInstanceOf(BadRequestException);
  expect(await rejectionMessages(body)).toEqual(
    expect.arrayContaining([expect.stringContaining(property)]),
  );
};

describe('UploadTraceDto', () => {
  it('converts the multipart strings into the numbers the domain expects', async () => {
    const dto = await transform({
      caseId: CASE_ID,
      width: '3024',
      height: '4032',
      capturedAt: '2026-08-18T10:12:00.000Z',
      orientation: '6',
      focalLength: '6.86',
      deviceModel: 'iPhone 14 Pro',
    });

    expect(dto.width).toBe(3024);
    expect(dto.height).toBe(4032);
    expect(dto.orientation).toBe(6);
    expect(dto.focalLength).toBe(6.86);
    expect(dto.capturedAt).toBe('2026-08-18T10:12:00.000Z');
    expect(dto.deviceModel).toBe('iPhone 14 Pro');
  });

  it('accepts an upload carrying no capture metadata at all', async () => {
    const dto = await transform({ caseId: CASE_ID });

    expect(dto.caseId).toBe(CASE_ID);
    expect(dto.width).toBeUndefined();
    expect(dto.height).toBeUndefined();
    expect(dto.capturedAt).toBeUndefined();
    expect(dto.orientation).toBeUndefined();
    expect(dto.focalLength).toBeUndefined();
    expect(dto.deviceModel).toBeUndefined();
    expect(dto.captureQuality).toBeUndefined();
  });

  it('rejects a height sent without its width', async () => {
    await expectRejection({ caseId: CASE_ID, height: '4032' }, 'width');
  });

  it('rejects a width sent without its height', async () => {
    await expectRejection({ caseId: CASE_ID, width: '3024' }, 'height');
  });

  it.each(['0', '9', '6.5', 'abc'])(
    'rejects the orientation %p',
    async (orientation) => {
      await expectRejection({ caseId: CASE_ID, orientation }, 'orientation');
    },
  );

  it.each(['abc', '0', '-1', '3024.5'])(
    'rejects the width %p',
    async (width) => {
      await expectRejection(
        { caseId: CASE_ID, width, height: '4032' },
        'width',
      );
    },
  );

  it.each(['0', '-6.86', 'abc'])(
    'rejects the focal length %p',
    async (focalLength) => {
      await expectRejection({ caseId: CASE_ID, focalLength }, 'focalLength');
    },
  );

  it('rejects a capture date that is not ISO 8601', async () => {
    await expectRejection(
      { caseId: CASE_ID, capturedAt: 'nope' },
      'capturedAt',
    );
  });

  it('rejects a device model longer than 120 characters', async () => {
    await expectRejection(
      { caseId: CASE_ID, deviceModel: 'a'.repeat(121) },
      'deviceModel',
    );
  });

  describe('captureQuality', () => {
    it('parses the JSON string the phone puts in the multipart body', async () => {
      const dto = await transform({
        caseId: CASE_ID,
        captureQuality: '{"blurScore":128.4,"passed":true}',
      });

      expect(dto.captureQuality).toEqual({ blurScore: 128.4, passed: true });
    });

    it('keeps a check the phone marked as failed', async () => {
      const dto = await transform({
        caseId: CASE_ID,
        captureQuality: '{"blurScore":12.5,"passed":false}',
      });

      expect(dto.captureQuality).toEqual({ blurScore: 12.5, passed: false });
    });

    it('accepts a blur score of zero', async () => {
      const dto = await transform({
        caseId: CASE_ID,
        captureQuality: '{"blurScore":0,"passed":false}',
      });

      expect(dto.captureQuality?.blurScore).toBe(0);
    });

    it.each([
      ['a truncated object', '{"blurScore":128.4'],
      ['an empty string', ''],
      ['plain words', 'tres net'],
    ])(
      'rejects %s, which is not JSON at all, naming the expected shape',
      async (_label, captureQuality) => {
        await expectRejection(
          { caseId: CASE_ID, captureQuality },
          'captureQuality doit être un objet JSON',
        );
      },
    );

    it.each([
      ['a number', '12'],
      ['a JSON null', 'null'],
      ['a boolean', 'true'],
      ['a quoted string', '"tres net"'],
      ['an array', '[{"blurScore":1,"passed":true}]'],
    ])(
      'rejects %s, which is JSON but not an object, naming the expected shape',
      async (_label, captureQuality) => {
        await expectRejection(
          { caseId: CASE_ID, captureQuality },
          'captureQuality doit être un objet JSON',
        );
      },
    );

    it.each([
      ['missing', '{"passed":true}'],
      ['a string', '{"blurScore":"128.4","passed":true}'],
      ['null', '{"blurScore":null,"passed":true}'],
    ])(
      'rejects a blur score that is %s, saying it expects a number',
      async (_label, captureQuality) => {
        await expectRejection(
          { caseId: CASE_ID, captureQuality },
          'captureQuality.blurScore must be a number',
        );
      },
    );

    it('rejects a negative blur score, saying it expects a positive one', async () => {
      await expectRejection(
        { caseId: CASE_ID, captureQuality: '{"blurScore":-1,"passed":true}' },
        'captureQuality.blurScore must not be less than 0',
      );
    });

    it.each([
      ['missing', '{"blurScore":128.4}'],
      ['a string', '{"blurScore":128.4,"passed":"true"}'],
      ['a number', '{"blurScore":128.4,"passed":1}'],
      ['null', '{"blurScore":128.4,"passed":null}'],
    ])('rejects a verdict that is %s', async (_label, captureQuality) => {
      await expectRejection({ caseId: CASE_ID, captureQuality }, 'passed');
    });

    it('rejects the perpendicularity field dropped in B2, and any other extra key', async () => {
      await expectRejection(
        {
          caseId: CASE_ID,
          captureQuality:
            '{"blurScore":128.4,"passed":true,"perpendicularityDeviation":3}',
        },
        'perpendicularityDeviation',
      );
    });
  });

  it('still rejects an unknown field, metadata or not', async () => {
    await expectRejection(
      { caseId: CASE_ID, nimportequoi: '1' },
      'nimportequoi',
    );
  });
});
