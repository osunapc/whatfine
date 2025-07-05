import * as Yup from "yup";
import AppError from "../../errors/AppError";
import prisma from "../../database";
import { Whatsapp as PrismaWhatsapp, Prisma } from "../../generated/prisma";
import ShowWhatsAppService from "./ShowWhatsAppService"; // Ya refactorizado
import { WhatsappWithQueues } from "./ListWhatsAppsService"; // Reutilizar tipo

/**
 * Interfaz para los datos a actualizar en una conexión de WhatsApp.
 * Todos los campos son opcionales.
 */
interface WhatsappData {
  name?: string;
  status?: string;
  session?: string;
  isDefault?: boolean;
  greetingMessage?: string;
  farewellMessage?: string;
  queueIds?: number[];
}

/**
 * Interfaz para la solicitud del servicio de actualización.
 */
interface Request {
  whatsappData: WhatsappData;
  whatsappId: string;
}

/**
 * Interfaz para la respuesta del servicio de actualización.
 */
interface Response {
  whatsapp: WhatsappWithQueues;
  oldDefaultWhatsapp: PrismaWhatsapp | null;
}

/**
 * Servicio para actualizar una conexión de WhatsApp existente.
 * Maneja la lógica de 'isDefault' y la actualización de colas asociadas.
 * @returns Una promesa que se resuelve a la conexión actualizada y la anterior por defecto (si aplica).
 * @throws AppError si la validación falla, la conexión no se encuentra o hay errores de negocio.
 */
const UpdateWhatsAppService = async ({
  whatsappData,
  whatsappId
}: Request): Promise<Response> => {
  const id = parseInt(whatsappId, 10);
  if (isNaN(id)) {
    throw new AppError("ERR_INVALID_WAPP_ID", 400);
  }

  const schema = Yup.object().shape({
    name: Yup.string().min(2).test(
      "Check-name",
      "This whatsapp name is already used.",
      async value => {
        if (!value) return true; // Permite no cambiar el nombre
        const nameExists = await prisma.whatsapp.findFirst({
          where: { name: value, id: { not: id } } // Excluir el whatsapp actual de la búsqueda
        });
        return !nameExists;
      }
    ),
    status: Yup.string(),
    isDefault: Yup.boolean()
  });

  const {
    name,
    status,
    isDefault,
    session,
    greetingMessage,
    farewellMessage,
    queueIds
  } = whatsappData;

  try {
    await schema.validate({ name, status, isDefault });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  if (queueIds && queueIds.length > 1 && !greetingMessage) {
    // Solo validar si se proporcionan queueIds y greetingMessage no está presente o está vacío
    // y si el greetingMessage actual del whatsapp tampoco existe.
    // La lógica original era: if (queueIds.length > 1 && !greetingMessage)
    // Lo que significa que si se actualizan las colas a más de una y no se proporciona un nuevo
    // greetingMessage, debe fallar.
    const currentWhatsapp = await ShowWhatsAppService(whatsappId); // Para chequear greetingMessage actual si no se pasa uno nuevo
    if (!greetingMessage && !currentWhatsapp.greetingMessage) {
       throw new AppError("ERR_WAPP_GREETING_REQUIRED");
    }
  }


  let oldDefaultWhatsapp: PrismaWhatsapp | null = null;

  const updateLogic = async (tx: Prisma.TransactionClient): Promise<PrismaWhatsapp> => {
    if (isDefault === true) {
      oldDefaultWhatsapp = await tx.whatsapp.findFirst({
        where: { isDefault: true, id: { not: id } }
      });
      if (oldDefaultWhatsapp) {
        await tx.whatsapp.update({
          where: { id: oldDefaultWhatsapp.id },
          data: { isDefault: false }
        });
      }
    }

    const updatePayload: Prisma.WhatsappUpdateInput = {
      name,
      status,
      session,
      greetingMessage,
      farewellMessage,
    };
    // Solo incluir isDefault en el payload si se proporciona explícitamente
    if (isDefault !== undefined) {
        updatePayload.isDefault = isDefault;
    }


    if (queueIds) {
      updatePayload.whatsappQueues = {
        deleteMany: { whatsappId: id }, // Eliminar todas las asociaciones existentes
        create: queueIds.map(queueId => ({ // Crear las nuevas
          queue: { connect: { id: queueId } }
        }))
      };
    }

    return tx.whatsapp.update({
      where: { id },
      data: updatePayload,
      include: { whatsappQueues: { include: { queue: true } } }
    });
  };

  let updatedWhatsappFull;
  // Ejecutar en transacción si se va a cambiar el estado de isDefault
  if (isDefault === true) {
      updatedWhatsappFull = await prisma.$transaction(updateLogic);
  } else {
      // Si isDefault no es true (o es false o undefined), no necesitamos la lógica transaccional para oldDefault.
      // pero ShowWhatsAppService ya fue llamado, podemos usar `prisma` directamente
      updatedWhatsappFull = await updateLogic(prisma);
  }

  const responseWhatsapp: WhatsappWithQueues = {
    ...updatedWhatsappFull,
    queues: updatedWhatsappFull.whatsappQueues ? updatedWhatsappFull.whatsappQueues.map(wq => wq.queue) : []
  };

  return { whatsapp: responseWhatsapp, oldDefaultWhatsapp };
};

export default UpdateWhatsAppService;
