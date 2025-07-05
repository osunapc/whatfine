import prisma from "../../database";
import { User as PrismaUser, Queue as PrismaQueue, Whatsapp as PrismaWhatsapp } from "../../generated/prisma";

/**
 * Interfaz para los parámetros de solicitud del servicio de listado de usuarios.
 */
interface Request {
  /** Parámetro de búsqueda para filtrar usuarios por nombre o email. */
  searchParam?: string;
  /** Número de página para la paginación. */
  pageNumber?: string | number;
}

// Definición del tipo User para la respuesta, incluyendo las relaciones que se esperan.
// Esto es importante para que coincida con la estructura que el frontend u otros servicios puedan esperar.
type UserWithRelations = PrismaUser & {
  queues?: PrismaQueue[]; // Las colas se anidarán a través de userQueues
  whatsapp?: PrismaWhatsapp | null;
};

/**
 * Interfaz para la respuesta del servicio de listado de usuarios.
 */
interface Response {
  /** Array de usuarios encontrados. */
  users: UserWithRelations[];
  /** Número total de usuarios que coinciden con la búsqueda. */
  count: number;
  /** Indica si hay más páginas disponibles. */
  hasMore: boolean;
}

/**
 * Servicio para listar usuarios con paginación y búsqueda por nombre o email.
 * @param searchParam Texto a buscar en el nombre o email de los usuarios.
 * @param pageNumber Número de página solicitado.
 * @returns Una promesa que se resuelve a un objeto con los usuarios, el conteo total y si hay más páginas.
 */
const ListUsersService = async ({
  searchParam = "",
  pageNumber = "1"
}: Request): Promise<Response> => {
  const limit = 20;
  const offset = limit * (Number(pageNumber) - 1);
  const trimmedSearchParam = searchParam.toLowerCase().trim();

  const whereCondition = trimmedSearchParam
    ? {
        OR: [
          {
            name: {
              contains: trimmedSearchParam,
              mode: "insensitive"
            }
          },
          {
            email: {
              contains: trimmedSearchParam,
              mode: "insensitive"
            }
          }
        ]
      }
    : {};

  const usersData = await prisma.user.findMany({
    where: whereCondition,
    select: { // Seleccionar explícitamente los campos necesarios
      name: true,
      id: true,
      email: true,
      profile: true,
      createdAt: true,
      userQueues: { // Para obtener las colas
        select: {
          queue: {
            select: {
              id: true,
              name: true,
              color: true
            }
          }
        }
      },
      whatsapp: { // Para obtener la conexión de WhatsApp
        select: {
          id: true,
          name: true
        }
      }
    },
    take: limit,
    skip: offset,
    orderBy: {
      createdAt: "desc"
    }
  });

  const count = await prisma.user.count({
    where: whereCondition
  });

  const hasMore = count > offset + usersData.length;

  // Mapear los datos para que 'queues' sea un array directo como en la versión Sequelize
  const users: UserWithRelations[] = usersData.map(u => ({
    ...u,
    queues: u.userQueues.map(uq => uq.queue)
  }));


  return {
    users,
    count,
    hasMore
  };
};

export default ListUsersService;
