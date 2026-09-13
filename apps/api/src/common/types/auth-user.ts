/** Access token payload'idan tiklanadigan foydalanuvchi ma'lumoti */
export interface AuthUser {
  id: string;
  email: string;
  roles: string[]; // rol kodlari: ADMIN, REFEREE, ...
  permissions: string[]; // permission kodlari: match.score, ...
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  iss?: string;
  aud?: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string; // RefreshToken.id
  fam: string; // familyId — o'g'irlangan token aniqlansa butun oila bekor qilinadi
}
