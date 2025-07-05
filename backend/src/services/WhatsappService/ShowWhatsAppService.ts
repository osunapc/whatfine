import prisma from "../../database";
import AppError from "../../errors/AppError";
import { Whatsapp as PrismaWhatsapp, Queue as PrismaQueue } from "../../generated/prisma";
import { WhatsappWithQueues } from "./ListWhatsAppsService"; // Reutilizar el tipo

/**
 * Servicio para obtener una conexión de WhatsApp específica por su ID, incluyendo las colas asociadas.
 * @param id El ID de la conexión de WhatsApp a obtener (puede ser string o number).
 * @returns Una promesa que se resuelve a la conexión de WhatsApp encontrada.
 * @throws AppError si la conexión no se encuentra o el ID es inválido.
 */
const ShowWhatsAppService = async (id: string | number): Promise<WhatsappWithQueues> => {
  const whatsappId = typeof id === 'string' ? parseInt(id, 10) : id;

  if (isNaN(whatsappId)) {
    throw new AppError("ERR_INVALID_WAPP_ID", 400);
  }

  const whatsappData = await prisma.whatsapp.findUnique({
    where: { id: whatsappId },
    include: {
      whatsappQueues: {
        include: {
          queue: true
        },
        orderBy: { // Ordenar las colas por nombre como en la versión original
          queue: {
            name: 'asc'
          }
        }
      }
    }
  });

  if (!whatsappData) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  // Mapear los datos para que 'queues' sea un array directo
  const whatsapp: WhatsappWithQueues = {
    ...whatsappData,
    queues: whatsappData.whatsappQueues ? whatsappData.whatsappQueues.map(wq => wq.queue) : []
  };

  return whatsapp;
};

export default ShowWhatsAppService;
