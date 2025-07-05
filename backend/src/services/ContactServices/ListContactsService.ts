import prisma from "../../database";
import { Contact } from "../../generated/prisma";

/**
 * Interfaz para los parámetros de solicitud del servicio de listado de contactos.
 */
interface Request {
  /** Parámetro de búsqueda para filtrar contactos por nombre o número. */
  searchParam?: string;
  /** Número de página para la paginación. */
  pageNumber?: string;
}

/**
 * Interfaz para la respuesta del servicio de listado de contactos.
 */
interface Response {
  /** Array de contactos encontrados. */
  contacts: Contact[];
  /** Número total de contactos que coinciden con la búsqueda. */
  count: number;
  /** Indica si hay más páginas disponibles. */
  hasMore: boolean;
}

/**
 * Servicio para listar contactos con paginación y búsqueda por nombre o número.
 * @param searchParam Texto a buscar en el nombre o número de los contactos.
 * @param pageNumber Número de página solicitado.
 * @returns Una promesa que se resuelve a un objeto con los contactos, el conteo total y si hay más páginas.
 */
const ListContactsService = async ({
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
            number: {
              contains: trimmedSearchParam
            }
          }
        ]
      }
    : {};

  const contacts = await prisma.contact.findMany({
    where: whereCondition,
    take: limit,
    skip: offset,
    orderBy: {
      name: "asc"
    }
  });

  const count = await prisma.contact.count({
    where: whereCondition
  });

  const hasMore = count > offset + contacts.length;

  return {
    contacts,
    count,
    hasMore
  };
};

export default ListContactsService;
