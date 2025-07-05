import prisma from "../../database";
import { Queue as PrismaQueue } from "../../generated/prisma";

/**
 * Servicio para listar todas las colas de atención.
 * @returns Una promesa que se resuelve a un array de colas, ordenadas por nombre.
 */
const ListQueuesService = async (): Promise<PrismaQueue[]> => {
  const queues = await prisma.queue.findMany({
    orderBy: {
      name: "asc"
    }
  });

  return queues;
};

export default ListQueuesService;
