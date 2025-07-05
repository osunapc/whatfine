import * as Yup from "yup";
import AppError from "../../errors/AppError";
import prisma from "../../database";
import { Queue as PrismaQueue, Prisma } from "../../generated/prisma";
import ShowQueueService from "./ShowQueueService"; // Ya refactorizado

/**
 * Interfaz para los datos de entrada del servicio de actualización de colas.
 * Todos los campos son opcionales.
 */
interface QueueData {
  name?: string;
  color?: string;
  greetingMessage?: string;
}

/**
 * Servicio para actualizar una cola de atención existente.
 * @param queueId ID de la cola a actualizar.
 * @param queueData Datos de la cola a actualizar (name, color, greetingMessage).
 * @returns Una promesa que se resuelve a la cola actualizada.
 * @throws AppError si la validación de Yup falla o la cola no se encuentra.
 */
const UpdateQueueService = async (
  queueId: number | string,
  queueData: QueueData
): Promise<PrismaQueue> => {
  const id = typeof queueId === 'string' ? parseInt(queueId, 10) : queueId;
  if (isNaN(id)) {
    throw new AppError("ERR_INVALID_QUEUE_ID", 400);
  }

  const { color, name, greetingMessage } = queueData;

  const queueSchema = Yup.object().shape({
    name: Yup.string()
      .min(2, "ERR_QUEUE_INVALID_NAME")
      .test(
        "Check-unique-name",
        "ERR_QUEUE_NAME_ALREADY_EXISTS",
        async value => {
          if (value) {
            const queueWithSameName = await prisma.queue.findFirst({
              where: { name: value, id: { not: id } }
            });
            return !queueWithSameName;
          }
          return true; // Permite no actualizar el nombre
        }
      ),
    color: Yup.string()
      // .required("ERR_QUEUE_INVALID_COLOR") // Color puede no ser actualizado, quitar required
      .matches(/^#[0-9a-f]{3,6}$/i, "ERR_QUEUE_INVALID_COLOR_FORMAT")
      .test(
        "Check-color-exists",
        "ERR_QUEUE_COLOR_ALREADY_EXISTS",
        async value => {
          if (value) {
            const queueWithSameColor = await prisma.queue.findFirst({
              where: { color: value, id: { not: id } }
            });
            return !queueWithSameColor;
          }
          return true; // Permite no actualizar el color
        }
      )
  });

  try {
    // Validar solo si se proporcionan los campos, y usar el contexto para el ID
    await queueSchema.validate({ color, name }, { context: { queueId: id } });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // ShowQueueService ya verifica si la cola existe y lanza error.
  await ShowQueueService(id);

  const updatedQueue = await prisma.queue.update({
    where: { id },
    data: {
      name,
      color,
      greetingMessage
    }
  });

  return updatedQueue;
};

export default UpdateQueueService;
