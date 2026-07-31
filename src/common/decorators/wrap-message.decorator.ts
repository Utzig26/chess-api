import { SetMetadata } from '@nestjs/common';

export const WRAP_MESSAGE_KEY = 'wrapMessage';

export const WrapMessage = (message: string) =>
  SetMetadata(WRAP_MESSAGE_KEY, message);
