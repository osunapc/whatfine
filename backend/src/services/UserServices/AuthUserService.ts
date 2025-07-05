import bcrypt from "bcryptjs";
import AppError from "../../errors/AppError";
import {
  createAccessToken,
  createRefreshToken
} from "../../helpers/CreateTokens";
import { SerializeUser, SerializedUser } from "../../helpers/SerializeUser"; // Asumiendo que SerializedUser se exporta
import prisma from "../../database";
import { User, Queue } from "../../generated/prisma"; // Importar tipos de Prisma

// Si SerializedUser no se exporta desde SerializeUser, la definimos aquí o la importamos correctamente.
// Por ahora, asumiré que SerializeUser.ts la exportará o la adaptaremos.
// interface SerializedUser {
//   id: number;
//   name: string;
//   email: string;
//   profile: string;
//   queues: Queue[]; // Queue de Prisma
// }

/**
 * Interfaz para la solicitud del servicio de autenticación de usuarios.
 */
interface Request {
  /** Correo electrónico del usuario. */
  email: string;
  /** Contraseña del usuario. */
  password: string;
}

/**
 * Interfaz para la respuesta del servicio de autenticación.
 */
interface Response {
  /** Usuario serializado (sin datos sensibles). */
  serializedUser: SerializedUser; // Usar el tipo importado o definido
  /** Token de acceso JWT. */
  token: string;
  /** Token de refresco JWT. */
  refreshToken: string;
}

/**
 * Servicio para autenticar un usuario y generar tokens de acceso y refresco.
 * @param email Correo electrónico del usuario.
 * @param password Contraseña del usuario.
 * @returns Una promesa que se resuelve a un objeto con el usuario serializado y los tokens.
 * @throws AppError si las credenciales son inválidas.
 */
const AuthUserService = async ({
  email,
  password
}: Request): Promise<Response> => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      userQueues: { // Acceder a través de la tabla de unión UserQueue
        include: {
          queue: true // Incluir los datos de la Cola
        }
      }
    }
  });

  if (!user) {
    throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  }

  // Adaptar la creación de tokens y serialización para el objeto User de Prisma.
  // SerializeUser podría necesitar ajustes si espera una instancia de Sequelize.
  // Por ahora, asumimos que puede manejar el objeto User de Prisma o lo adaptaremos.

  // Para pasar las colas de manera similar a como estaban antes (array de Queues)
  const userWithQueues = {
    ...user,
    queues: user.userQueues.map(uq => uq.queue)
  };

  const token = createAccessToken(userWithQueues as any); // Puede requerir casteo si los helpers esperan tipos específicos
  const refreshToken = createRefreshToken(userWithQueues as any); // Puede requerir casteo

  // Asumimos que SerializeUser toma un objeto compatible con User de Prisma + campo 'queues'
  const serializedUser = SerializeUser(userWithQueues as any);


  return {
    serializedUser,
    token,
    refreshToken
  };
};

export default AuthUserService;
