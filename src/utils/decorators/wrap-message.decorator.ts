import { SetMetadata } from '@nestjs/common';
export const WrapMessage = (msg: string) => SetMetadata('wrapMessage', msg);
