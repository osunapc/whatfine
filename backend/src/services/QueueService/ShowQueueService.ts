import AppError from "../../errors/AppError";
import prisma from "../../database";
import { Queue as PrismaQueue } from "../../generated/prisma";

/**
 * Servicio para obtener una cola específica por su ID.
 * @param queueId El ID de la cola a obtener (puede ser string o number).
 * @returns Una promesa que se resuelve a la cola encontrada.
 * @throws AppError si la cola no se encuentra o el ID es inválido.
 */
const ShowQueueService = async (queueId: number | string): Promise<PrismaQueue> => {
  const id = typeof queueId === 'string' ? parseInt(queueId, 10) : queueId;

  if (isNaN(id)) {
    throw new AppError("ERR_INVALID_QUEUE_ID", 400);
  }

  const queue = await prisma.queue.findUnique({
    where: { id }
  });

  if (!queue) {
    throw new AppError("ERR_QUEUE_NOT_FOUND", 404); // Usar 404 para "no encontrado"
  }

  return queue;
};

export default ShowQueueService;
