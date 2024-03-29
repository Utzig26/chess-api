import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      //jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      jwtFromRequest: ExtractJwt.fromExtractors([(request:Request) => {
        const data = request?.cookies["jwt"];
        if(!data){
          try{
            return request?.headers.authorization.replace('Bearer ','');
          }catch { 
            return null;
          }
        }
        return data;
      }]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  /**
   * Validates accessToken.
   * @param payload - user's payload (accessToken extracted from Authorization header)
   * @returns user's data if accessToken is valid.
   */
  async validate(payload: any) {
    return { user: payload };
  }
}