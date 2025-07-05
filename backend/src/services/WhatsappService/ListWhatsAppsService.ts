import prisma from "../../database";
import { Whatsapp as PrismaWhatsapp, Queue as PrismaQueue } from "../../generated/prisma";

// Definición del tipo de respuesta para mayor claridad
export type WhatsappWithQueues = PrismaWhatsapp & {
  queues: PrismaQueue[];
};

/**
 * Servicio para listar todas las conexiones de WhatsApp, incluyendo las colas asociadas.
 * @returns Una promesa que se resuelve a un array de conexiones de WhatsApp con sus colas.
 */
const ListWhatsAppsService = async (): Promise<WhatsappWithQueues[]> => {
  const whatsappsData = await prisma.whatsapp.findMany({
    include: {
      whatsappQueues: { // Incluir la tabla de unión
        include: {
          queue: true // Incluir los datos de la cola desde la tabla de unión
        }
      }
    }
  });

  // Mapear los datos para que 'queues' sea un array directo como en la versión Sequelize
  const whatsapps: WhatsappWithQueues[] = whatsappsData.map(w => ({
    ...w,
    // Asegurarse de que queues no sea undefined si no hay whatsappQueues
    queues: w.whatsappQueues ? w.whatsappQueues.map(wq => wq.queue) : []
  }));

  return whatsapps;
};

export default ListWhatsAppsService;
