import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { User } from '../../users/schema/user.schema';
import { UserSignDto } from '../../users/dto/user.sign.dto';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(userSignDto: UserSignDto): Promise<User> {
    console.log(userSignDto);
    const user = await this.authService.validateUser(userSignDto);
    if (!user) throw new UnauthorizedException();

    return user;
  }
}
