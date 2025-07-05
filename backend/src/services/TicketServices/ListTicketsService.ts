import { startOfDay, endOfDay, parseISO } from "date-fns";
import prisma from "../../database";
import { Ticket as PrismaTicket, Prisma } from "../../generated/prisma";
import ShowUserService from "../UserServices/ShowUserService"; // Ya refactorizado
import { ShowTicketPrisma } from "./ShowTicketService"; // Importar tipo para consistencia

/**
 * Interfaz para los parámetros de solicitud del servicio de listado de tickets.
 */
interface Request {
  searchParam?: string;
  pageNumber?: string;
  status?: string;
  date?: string;
  showAll?: string; // "true" o "false"
  userId: string; // ID del usuario que realiza la solicitud
  withUnreadMessages?: string; // "true" o "false"
  queueIds: number[]; // IDs de las colas a las que el usuario tiene acceso
}

/**
 * Interfaz para la respuesta del servicio de listado de tickets.
 */
interface Response {
  tickets: ShowTicketPrisma[]; // Usar el tipo detallado de ShowTicketService
  count: number;
  hasMore: boolean;
}

/**
 * Servicio para listar tickets con filtros complejos, paginación y búsqueda.
 */
const ListTicketsService = async ({
  searchParam = "",
  pageNumber = "1",
  queueIds,
  status,
  date,
  showAll,
  userId: requestUserId, // Renombrar para claridad
  withUnreadMessages
}: Request): Promise<Response> => {
  const limit = 40;
  const offset = limit * (Number(pageNumber) - 1);
  const parsedUserId = parseInt(requestUserId, 10);

  let where: Prisma.TicketWhereInput = {};
  const OR_conditions: Prisma.TicketWhereInput[] = [];

  // Lógica base de permisos: tickets del usuario o pendientes en sus colas
  if (showAll !== "true") {
    where.OR = [
      { userId: parsedUserId },
      { status: "pending" }
    ];
    // Si no es showAll, también filtrar por las queueIds proporcionadas o que no tengan cola
    where.queueId = { in: [...queueIds, null] };
  } else {
    // Si es showAll, solo filtrar por las queueIds o que no tengan cola (acceso general a esas colas)
     where.queueId = { in: [...queueIds, null] };
  }

  if (status) {
    where.status = status;
  }

  if (date) {
    const parsedDate = parseISO(date);
    where.createdAt = {
      gte: startOfDay(parsedDate),
      lte: endOfDay(parsedDate)
    };
  }

  if (withUnreadMessages === "true") {
    // Esta lógica es compleja porque la original obtenía las colas del usuario desde ShowUserService.
    // Asumimos que `queueIds` ya son las colas a las que el usuario tiene acceso si `showAll` no es true.
    // Si `showAll` es true, `withUnreadMessages` se aplicaría a todas las colas visibles.
    const user = await ShowUserService(requestUserId); // requestUserId es string
    const userQueueIds = user.queues?.map(queue => queue.id) || [];

    let unreadWhere: Prisma.TicketWhereInput = { unreadMessages: { gt: 0 } };

    if (showAll !== "true") {
        unreadWhere.OR = [
            { userId: parsedUserId },
            { status: "pending", queueId: { in: [...userQueueIds, null] } }
        ];
    } else {
        // Si showAll es true, el filtro de queueId ya está aplicado globalmente.
        // Solo necesitamos añadir la condición de unreadMessages.
        // No es necesario re-aplicar filtros de usuario o estado pendiente aquí para 'unread'
        // ya que se combinará con el 'where' principal.
    }
     where = { ...where, ...unreadWhere};
     // La lógica original era:
     // whereCondition = {
     //   [Op.or]: [{ userId }, { status: "pending" }],
     //   queueId: { [Op.or]: [userQueueIds, null] },
     //   unreadMessages: { [Op.gt]: 0 }
     // };
     // Esto significa que un ticket debe cumplir (ser del usuario O ser pendiente) Y (estar en sus colas) Y (tener mensajes no leídos)
     // La forma de construir el `where` debe reflejar esto.
     // Reconstruyendo la lógica para `withUnreadMessages`:
     const unreadSpecificConditions: Prisma.TicketWhereInput = { unreadMessages: { gt: 0 }};
     if (showAll !== "true") {
        unreadSpecificConditions.OR = [ {userId: parsedUserId }, {status: "pending"}];
        unreadSpecificConditions.queueId = {in: [...userQueueIds, null]};
     } else {
        // Si showAll es true, el filtro de queueId ya está en el 'where' principal.
        // Solo se añade la condición de unreadMessages.
     }
      where = Prisma.validator<Prisma.TicketWhereInput>()({ AND: [where, unreadSpecificConditions] });
  }


  if (searchParam) {
    const trimmedSearchParam = searchParam.toLowerCase().trim();
    const searchConditions: Prisma.TicketWhereInput = {
      OR: [
        {
          contact: {
            OR: [
              { name: { contains: trimmedSearchParam, mode: "insensitive" } },
              { number: { contains: trimmedSearchParam } } // Asumiendo que el número no necesita insensitive
            ]
          }
        },
        {
          messages: {
            some: { // "some" para buscar si ALGUNO de los mensajes cumple la condición
              body: { contains: trimmedSearchParam, mode: "insensitive" }
            }
          }
        }
      ]
    };
    // Combinar con el where existente:
    // Si where.OR ya existe, añadimos estas condiciones a un nivel superior con AND
    // o intentamos fusionar los OR si la lógica lo permite.
    // Por simplicidad, si 'where' ya tiene condiciones, las envolvemos en un AND con searchConditions.
    if (Object.keys(where).length > 0) {
        where = { AND: [where, searchConditions] };
    } else {
        where = searchConditions;
    }
  }

  const tickets = await prisma.ticket.findMany({
    where,
    include: { // Incluir relaciones necesarias para el tipo ShowTicketPrisma
      contact: { include: { customFields: true } },
      user: { select: { id: true, name: true } },
      queue: { select: { id: true, name: true, color: true } },
      whatsapp: { select: { name: true } }
      // No incluimos messages aquí para evitar traer todos los mensajes,
      // la búsqueda por mensaje se hizo con `messages: { some: ... }`
    },
    take: limit,
    skip: offset,
    orderBy: { updatedAt: "desc" }
  });

  const count = await prisma.ticket.count({ where });

  const hasMore = count > offset + tickets.length;

  return {
    tickets: tickets as ShowTicketPrisma[], // Castear al tipo esperado
    count,
    hasMore
  };
};

export default ListTicketsService;
