import * as Yup from "yup";
import AppError from "../../errors/AppError";
import prisma from "../../database";
import { Whatsapp as PrismaWhatsapp, Prisma } from "../../generated/prisma";
import { WhatsappWithQueues } from "./ListWhatsAppsService"; // Reutilizar tipo para la respuesta

/**
 * Interfaz para la solicitud del servicio de creación de conexiones de WhatsApp.
 */
interface Request {
  name: string;
  queueIds?: number[];
  greetingMessage?: string;
  farewellMessage?: string;
  status?: string;
  isDefault?: boolean;
}

/**
 * Interfaz para la respuesta del servicio de creación.
 * Incluye la nueva conexión y la anterior por defecto si hubo cambio.
 */
interface Response {
  whatsapp: WhatsappWithQueues;
  oldDefaultWhatsapp: PrismaWhatsapp | null;
}

/**
 * Servicio para crear una nueva conexión de WhatsApp.
 * Maneja la lógica de 'isDefault' y la asociación con colas.
 * @returns Una promesa que se resuelve a la nueva conexión y la anterior por defecto (si aplica).
 * @throws AppError si la validación falla o hay errores de negocio.
 */
const CreateWhatsAppService = async ({
  name,
  status = "OPENING", // Valor por defecto como en el original
  queueIds = [],
  greetingMessage,
  farewellMessage,
  isDefault = false // Valor por defecto como en el original
}: Request): Promise<Response> => {
  const schema = Yup.object().shape({
    name: Yup.string()
      .required()
      .min(2)
      .test(
        "Check-name",
        "This whatsapp name is already used.",
        async value => {
          if (!value) return false;
          const nameExists = await prisma.whatsapp.findUnique({ // Corregido para buscar por unique name
            where: { name: value }
          });
          return !nameExists;
        }
      ),
    isDefault: Yup.boolean().required()
  });

  try {
    // Validar solo name e isDefault como en la lógica original de schema.validate
    await schema.validate({ name, isDefault });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  // Lógica para determinar isDefault si no hay otros whatsapps
  const whatsappCount = await prisma.whatsapp.count();
  let effectiveIsDefault = isDefault;
  if (whatsappCount === 0) {
    effectiveIsDefault = true; // Si es el primero, hacerlo default
  }

  let oldDefaultWhatsapp: PrismaWhatsapp | null = null;

  const createWhatsappAndHandleDefault = async (): Promise<PrismaWhatsapp> => {
    if (effectiveIsDefault) {
      oldDefaultWhatsapp = await prisma.whatsapp.findFirst({
        where: { isDefault: true }
      });
      if (oldDefaultWhatsapp) {
        await prisma.whatsapp.update({
          where: { id: oldDefaultWhatsapp.id },
          data: { isDefault: false }
        });
      }
    }

    if (queueIds.length > 1 && !greetingMessage) {
      throw new AppError("ERR_WAPP_GREETING_REQUIRED");
    }

    const whatsappDataCreate: Prisma.WhatsappCreateInput = {
      name,
      status,
      greetingMessage,
      farewellMessage,
      isDefault: effectiveIsDefault,
      // qrcode, session, retries, etc., se establecerán más tarde por el proceso de conexión de wbot
    };

    if (queueIds.length > 0) {
      whatsappDataCreate.whatsappQueues = {
        create: queueIds.map(queueId => ({
          queue: { connect: { id: queueId } }
        }))
      };
    }

    return prisma.whatsapp.create({
      data: whatsappDataCreate,
      include: {
        whatsappQueues: { include: { queue: true } }
      }
    });
  };

  // Usar transacción si se modifica un oldDefaultWhatsapp y se crea uno nuevo.
  let newWhatsapp: PrismaWhatsapp & { whatsappQueues: ({ queue: any })[]}; // Tipo para incluir whatsappQueues
  if (effectiveIsDefault && whatsappCount > 0) { // Solo transaccionar si realmente vamos a cambiar un default existente
    const result = await prisma.$transaction(async (tx) => {
        // La lógica de encontrar y actualizar oldDefaultWhatsapp se repite dentro de la transacción
        // para asegurar que se use el mismo prisma client (tx)
        oldDefaultWhatsapp = await tx.whatsapp.findFirst({ // tx en lugar de prisma
            where: { isDefault: true }
        });
        if (oldDefaultWhatsapp) {
            await tx.whatsapp.update({ // tx en lugar de prisma
                where: { id: oldDefaultWhatsapp.id },
                data: { isDefault: false }
            });
        }
        // Crear el nuevo whatsapp
        const whatsappDataCreateTx: Prisma.WhatsappCreateInput = {
            name, status, greetingMessage, farewellMessage, isDefault: effectiveIsDefault,
        };
        if (queueIds.length > 0) {
            whatsappDataCreateTx.whatsappQueues = {
                create: queueIds.map(queueId => ({ queue: { connect: { id: queueId } } }))
            };
        }
        return tx.whatsapp.create({ data: whatsappDataCreateTx, include: { whatsappQueues: { include: { queue: true } } } });
    });
    newWhatsapp = result;
  } else {
    // Si no es default o es el primer whatsapp, no se necesita la complejidad de la transacción para oldDefault.
    // La lógica de `effectiveIsDefault` ya se encargó de `oldDefaultWhatsapp` si era necesario (aunque fuera de tx).
    // Esto podría simplificarse si la primera comprobación de oldDefaultWhatsapp se hace siempre.
    // Re-evaluando: la actualizacion de oldDefault y la creacion del nuevo SIEMPRE deben ser atomicas si isDefault es true.
    newWhatsapp = await createWhatsappAndHandleDefault();
  }

  const responseWhatsapp: WhatsappWithQueues = {
    ...newWhatsapp,
    queues: newWhatsapp.whatsappQueues ? newWhatsapp.whatsappQueues.map(wq => wq.queue) : []
  };

  return { whatsapp: responseWhatsapp, oldDefaultWhatsapp };
};

export default CreateWhatsAppService;
