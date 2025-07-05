import {
  User as PrismaUser,
  Queue as PrismaQueue,
  Whatsapp as PrismaWhatsapp,
  UserQueue as PrismaUserQueue // Importar si se accede directamente
} from "../generated/prisma";

// Definir una interfaz para el usuario de Prisma tal como se espera que llegue
// con las relaciones necesarias para la serialización.
// Esto se alinea con lo que los servicios deberían incluir al obtener el usuario.
type UserForSerialization = PrismaUser & {
  whatsapp?: PrismaWhatsapp | null; // Whatsapp puede ser null
  userQueues?: (PrismaUserQueue & { queue: PrismaQueue })[]; // userQueues es la relación, y cada uno tiene una 'queue'
  // Si en algún punto se pasa 'queues' ya mapeado, este helper debería ser flexible o tener múltiples firmas.
  // Por ahora, asumimos que recibe 'userQueues'.
  queues?: PrismaQueue[]; // Para mantener compatibilidad si ya fue transformado antes.
};

/**
 * Interfaz para el objeto de usuario serializado.
 * Contiene los campos públicos del usuario y sus relaciones relevantes.
 */
export interface SerializedUser {
  id: number;
  name: string | null; // El nombre puede ser null según el schema de Prisma
  email: string;
  profile: string;
  queues: PrismaQueue[];
  whatsapp?: PrismaWhatsapp | null; // Whatsapp puede ser opcional o null
}

/**
 * Serializa un objeto de usuario (de Prisma) para exponer solo los campos necesarios y seguros.
 * @param user El objeto User de Prisma, que puede incluir relaciones como `whatsapp` y `userQueues`.
 * @returns Un objeto de usuario serializado.
 */
export const SerializeUser = (user: UserForSerialization): SerializedUser => {
  let queues: PrismaQueue[] = [];

  if (user.queues) { // Si 'queues' ya viene mapeado (como en AuthUserService)
    queues = user.queues;
  } else if (user.userQueues) { // Si viene la relación 'userQueues'
    queues = user.userQueues.map(uq => uq.queue);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    queues: queues,
    whatsapp: user.whatsapp // Puede ser null o undefined
  };
};
