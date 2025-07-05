import prisma from "../../database";
import AppError from "../../errors/AppError";
import { User as PrismaUser, Queue as PrismaQueue, Whatsapp as PrismaWhatsapp } from "../../generated/prisma";

// Definición del tipo User para la respuesta, similar a ListUsersService
type UserWithRelations = PrismaUser & {
  queues?: PrismaQueue[];
  whatsapp?: PrismaWhatsapp | null;
};

/**
 * Servicio para obtener un usuario específico por su ID, incluyendo sus colas y WhatsApp asociado.
 * @param id El ID del usuario a obtener (puede ser string o number).
 * @returns Una promesa que se resuelve al usuario encontrado.
 * @throws AppError si el usuario no se encuentra o el ID es inválido.
 */
const ShowUserService = async (id: string | number): Promise<UserWithRelations> => {
  const userId = typeof id === 'string' ? parseInt(id, 10) : id;

  if (isNaN(userId)) {
    throw new AppError("ERR_INVALID_USER_ID", 400);
  }

  const userData = await prisma.user.findUnique({
    where: { id: userId },
    select: { // Seleccionar explícitamente los campos necesarios
      name: true,
      id: true,
      email: true,
      profile: true,
      tokenVersion: true,
      whatsappId: true,
      createdAt: true, // Incluir createdAt y updatedAt si son necesarios para SerializeUser o respuesta
      updatedAt: true,
      passwordHash: true, // Necesario si SerializeUser lo usa o para alguna lógica interna
      userQueues: {
        select: {
          queue: {
            select: {
              id: true,
              name: true,
              color: true
            }
          }
        },
        orderBy: { // Ordenar las colas por nombre como en la versión original
          queue: {
            name: 'asc'
          }
        }
      },
      whatsapp: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!userData) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  // Mapear los datos para que 'queues' sea un array directo
  const user: UserWithRelations = {
    ...userData,
    queues: userData.userQueues.map(uq => uq.queue)
  };

  return user;
};

export default ShowUserService;
