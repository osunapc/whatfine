import { sign } from "jsonwebtoken";
import authConfig from "../config/auth";
// import User from "../models/User"; // Usar tipo de Prisma
import { User as PrismaUser } from "../generated/prisma";

// Definir un tipo para el usuario que se espera, puede ser parcial si solo se usan ciertos campos.
// O usar directamente PrismaUser si todos los campos necesarios están ahí.
// Los servicios como AuthUserService y RefreshTokenService pasan UserWithRelations,
// que es compatible con PrismaUser.
type UserForToken = Pick<PrismaUser, "id" | "name" | "profile" | "tokenVersion">;


/**
 * Crea un token de acceso JWT para un usuario.
 * @param user Objeto de usuario (o parcial) con id, name, y profile.
 * @returns El token de acceso JWT como string.
 */
export const createAccessToken = (user: UserForToken): string => {
  const { secret, expiresIn } = authConfig;

  return sign(
    // El payload original tenía 'usarname', lo mantendré por si el frontend lo espera así.
    // user.name puede ser null según el schema de Prisma.
    { usarname: user.name, profile: user.profile, id: user.id },
    secret,
    {
      expiresIn
    }
  );
};

/**
 * Crea un token de refresco JWT para un usuario.
 * @param user Objeto de usuario (o parcial) con id y tokenVersion.
 * @returns El token de refresco JWT como string.
 */
export const createRefreshToken = (user: UserForToken): string => {
  const { refreshSecret, refreshExpiresIn } = authConfig;

  return sign({ id: user.id, tokenVersion: user.tokenVersion }, refreshSecret, {
    expiresIn: refreshExpiresIn
  });
};
