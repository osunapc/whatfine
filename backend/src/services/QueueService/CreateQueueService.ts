import * as Yup from "yup";
import AppError from "../../errors/AppError";
import prisma from "../../database";
import { Queue as PrismaQueue, Prisma } from "../../generated/prisma";

/**
 * Interfaz para los datos de entrada del servicio de creación de colas.
 */
interface QueueData {
  name: string;
  color: string;
  greetingMessage?: string;
}

/**
 * Servicio para crear una nueva cola de atención.
 * @param queueData Datos de la cola a crear (name, color, greetingMessage).
 * @returns Una promesa que se resuelve a la cola creada.
 * @throws AppError si la validación de Yup falla (ej. nombre/color duplicado, formato de color inválido).
 */
const CreateQueueService = async (queueData: QueueData): Promise<PrismaQueue> => {
  const { color, name, greetingMessage } = queueData;

  const queueSchema = Yup.object().shape({
    name: Yup.string()
      .min(2, "ERR_QUEUE_INVALID_NAME")
      .required("ERR_QUEUE_INVALID_NAME")
      .test(
        "Check-unique-name",
        "ERR_QUEUE_NAME_ALREADY_EXISTS",
        async value => {
          if (value) {
            const queueWithSameName = await prisma.queue.findUnique({
              where: { name: value }
            });
            return !queueWithSameName;
          }
          return false; // O true si el campo es opcional y no se proporciona
        }
      ),
    color: Yup.string()
      .required("ERR_QUEUE_INVALID_COLOR")
      .matches(/^#[0-9a-f]{3,6}$/i, "ERR_QUEUE_INVALID_COLOR_FORMAT") // Usar matches para regex
      .test(
        "Check-color-exists",
        "ERR_QUEUE_COLOR_ALREADY_EXISTS",
        async value => {
          if (value) {
            const queueWithSameColor = await prisma.queue.findUnique({ // Color también es unique
              where: { color: value }
            });
            return !queueWithSameColor;
          }
          return false; // O true si el campo es opcional
        }
      )
  });

  try {
    await queueSchema.validate({ color, name });
  } catch (err: any) { // Especificar tipo para err
    throw new AppError(err.message);
  }

  const queue = await prisma.queue.create({
    data: {
      name,
      color,
      greetingMessage
    }
  });

  return queue;
};

export default CreateQueueService;
