import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { ErrorEnvelopeDto, SuccessEnvelopeDto } from '../dto/api-response.dto';

interface EnvelopeOptions {
  status: number;
  description: string;
  type?: Type<unknown>;
}

export const ApiEnvelopeResponse = ({
  status,
  description,
  type,
}: EnvelopeOptions) =>
  applyDecorators(
    ApiExtraModels(SuccessEnvelopeDto, ...(type ? [type] : [])),
    ApiResponse({
      status,
      description,
      schema: {
        allOf: [
          { $ref: getSchemaPath(SuccessEnvelopeDto) },
          {
            properties: {
              data: type ? { $ref: getSchemaPath(type) } : { nullable: true },
            },
          },
        ],
      },
    }),
  );

export const ApiEnvelopeErrorResponse = ({
  status,
  description,
}: Omit<EnvelopeOptions, 'type'>) =>
  applyDecorators(
    ApiExtraModels(ErrorEnvelopeDto),
    ApiResponse({
      status,
      description,
      schema: { $ref: getSchemaPath(ErrorEnvelopeDto) },
    }),
  );
