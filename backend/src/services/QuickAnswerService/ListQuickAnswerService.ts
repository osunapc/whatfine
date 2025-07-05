import prisma from "../../database";
import { QuickAnswer } from "../../generated/prisma";

/**
 * Interfaz para los parámetros de solicitud del servicio de listado de respuestas rápidas.
 */
interface Request {
  /** Parámetro de búsqueda para filtrar respuestas por mensaje. */
  searchParam?: string;
  /** Número de página para la paginación. */
  pageNumber?: string;
}

/**
 * Interfaz para la respuesta del servicio de listado de respuestas rápidas.
 */
interface Response {
  /** Array de respuestas rápidas encontradas. */
  quickAnswers: QuickAnswer[];
  /** Número total de respuestas rápidas que coinciden con la búsqueda. */
  count: number;
  /** Indica si hay más páginas disponibles. */
  hasMore: boolean;
}

/**
 * Servicio para listar respuestas rápidas con paginación y búsqueda.
 * @param searchParam Texto a buscar en el mensaje de las respuestas rápidas.
 * @param pageNumber Número de página solicitado.
 * @returns Una promesa que se resuelve a un objeto con las respuestas rápidas, el conteo total y si hay más páginas.
 */
const ListQuickAnswerService = async ({
  searchParam = "",
  pageNumber = "1"
}: Request): Promise<Response> => {
  const limit = 20;
  const offset = limit * (Number(pageNumber) - 1);

  const whereCondition = searchParam
    ? {
        message: {
          contains: searchParam.toLowerCase().trim(),
          mode: "insensitive" // Para búsqueda sin distinción entre mayúsculas y minúsculas
        }
      }
    : {};

  const quickAnswers = await prisma.quickAnswer.findMany({
    where: whereCondition,
    take: limit,
    skip: offset,
    orderBy: {
      message: "asc"
    }
  });

  const count = await prisma.quickAnswer.count({
    where: whereCondition
  });

  const hasMore = count > offset + quickAnswers.length;

  return {
    quickAnswers,
    count,
    hasMore
  };
};

export default ListQuickAnswerService;
