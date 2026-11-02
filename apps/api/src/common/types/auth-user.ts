/** Access token payload'idan tiklanadigan foydalanuvchi ma'lumoti */
export interface AuthUser {
  id: string;
  email: string;
  roles: string[]; // rol kodlari: ADMIN, REFEREE, ...
  permissions: string[]; // permission kodlari: match.score, ...
  /** Boshlang'ich parol berilgan: parol almashtirilmaguncha boshqa amallar yopiq */
  mustChangePassword?: boolean;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  mcp?: boolean; // mustChangePassword
  iss?: string;
  aud?: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string; // RefreshToken.id
  fam: string; // familyId — o'g'irlangan token aniqlansa butun oila bekor qilinadi
}
