import prisma from "../../database";
import AppError from "../../errors/AppError";
// No es necesario llamar a ShowQueueService, Prisma delete arrojará error si no existe (o podemos verificarlo antes).

/**
 * Servicio para eliminar una cola por su ID.
 * Se asume que las relaciones con Ticket (onDelete: SetNull),
 * UserQueue (onDelete: Cascade), y WhatsappQueue (onDelete: Cascade)
 * están configuradas correctamente en el esquema de Prisma.
 * @param queueId El ID de la cola a eliminar (puede ser string o number).
 * @returns Una promesa que se resuelve cuando la cola ha sido eliminada.
 * @throws AppError si la cola no se encuentra (manejado por Prisma) o el ID es inválido.
 */
const DeleteQueueService = async (queueId: number | string): Promise<void> => {
  const id = typeof queueId === 'string' ? parseInt(queueId, 10) : queueId;

  if (isNaN(id)) {
    throw new AppError("ERR_INVALID_QUEUE_ID", 400);
  }

  // Opcional: verificar si existe primero para dar un error personalizado o dejar que Prisma lo maneje.
  const queueExists = await prisma.queue.findUnique({ where: { id } });
  if (!queueExists) {
    throw new AppError("ERR_QUEUE_NOT_FOUND", 404);
  }

  // UserQueues y WhatsappQueues deberían eliminarse en cascada.
  // Tickets asociados deberían tener queueId puesto a NULL.
  await prisma.queue.delete({
    where: { id }
  });
};

export default DeleteQueueService;
