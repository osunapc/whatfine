import { verify } from "jsonwebtoken";
import { Response as Res } from "express";

// import User from "../../models/User"; // Usar tipo de Prisma
import { User as PrismaUser } from "../../generated/prisma"; // Importar tipo base de Prisma
import AppError from "../../errors/AppError";
import ShowUserService from "../UserServices/ShowUserService"; // Ya refactorizado
// ShowUserService devuelve UserWithRelations, que es compatible con PrismaUser e incluye relaciones
import { UserWithRelations } from "../UserServices/ShowUserService"; // Importar el tipo específico
import authConfig from "../../config/auth";
import {
  createAccessToken,
  createRefreshToken
} from "../../helpers/CreateTokens";

interface RefreshTokenPayload {
  id: string;
  tokenVersion: number;
}

/**
 * Interfaz para la respuesta del servicio de refresco de token.
 */
interface Response {
  /** El objeto de usuario completo (tipo Prisma con relaciones). */
  user: UserWithRelations;
  /** Nuevo token de acceso JWT. */
  newToken: string;
  /** Nuevo token de refresco JWT. */
  refreshToken: string;
}

export const RefreshTokenService = async (
  res: Res,
  token: string
): Promise<Response> => {
  try {
    const decoded = verify(token, authConfig.refreshSecret);
    const { id, tokenVersion } = decoded as RefreshTokenPayload;

    // ShowUserService ya devuelve UserWithRelations (tipo Prisma con relaciones)
    const user = await ShowUserService(id);

    if (user.tokenVersion !== tokenVersion) {
      res.clearCookie("jrt"); // Efecto secundario, considerar si debe estar aquí o en el controlador
      throw new AppError("ERR_SESSION_EXPIRED", 401);
    }

    // Asumimos que createAccessToken y createRefreshToken son compatibles con UserWithRelations
    // o serán adaptados. Podrían necesitar `user as any` temporalmente si son estrictos.
    const newToken = createAccessToken(user as any);
    const refreshToken = createRefreshToken(user as any);

    return { user, newToken, refreshToken };
  } catch (err) {
    res.clearCookie("jrt"); // Efecto secundario
    // Asegurarse de que el error lanzado sea apropiado o relanzar el original si es de AppError
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }
};
