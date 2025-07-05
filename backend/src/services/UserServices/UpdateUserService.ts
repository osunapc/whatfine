import * as Yup from "yup";
import bcrypt from "bcryptjs";
import AppError from "../../errors/AppError";
import { SerializeUser, SerializedUser } from "../../helpers/SerializeUser";
import prisma from "../../database";
import { Prisma, User as PrismaUser } from "../../generated/prisma"; // Renombrar User para evitar conflicto
import ShowUserService from "./ShowUserService"; // Ya refactorizado

/**
 * Interfaz para los datos a actualizar de un usuario.
 * Todos los campos son opcionales.
 */
interface UserData {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  queueIds?: number[];
  whatsappId?: number;
}

/**
 * Interfaz para la solicitud del servicio de actualización de usuarios.
 */
interface Request {
  userData: UserData;
  userId: string | number;
}

// Asumiendo que SerializedUser es el tipo de respuesta esperado.
// interface Response {
//   id: number;
//   name: string;
//   email: string;
//   profile: string;
// }

/**
 * Servicio para actualizar un usuario existente.
 * @param userData Objeto con los campos a actualizar.
 * @param userId ID del usuario a modificar.
 * @returns Una promesa que se resuelve al usuario serializado actualizado.
 * @throws AppError si la validación falla, el usuario no se encuentra, o el ID es inválido.
 */
const UpdateUserService = async ({
  userData,
  userId
}: Request): Promise<SerializedUser> => {
  // ShowUserService ya maneja la conversión de ID y error si no se encuentra o es inválido.
  // También devuelve el usuario con las colas y whatsapp ya formateados.
  const currentUserData = await ShowUserService(userId);

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    email: Yup.string().email().test(
      "Check-email",
      "An user with this email already exists.",
      async value => {
        if (!value || value === currentUserData.email) return true; // Permite el mismo email
        const emailExists = await prisma.user.findUnique({
          where: { email: value }
        });
        return !emailExists;
      }
    ),
    profile: Yup.string(),
    password: Yup.string().min(5) // Validar longitud si se proporciona
  });

  const { email, password, profile, name, queueIds, whatsappId } = userData;

  try {
    // Validar solo los campos que se proporcionan en userData
    await schema.validate(
      { email, password, profile, name },
      { abortEarly: false, stripUnknown: true } // stripUnknown para no validar campos no definidos en schema si no están en userData
    );
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const updateData: Prisma.UserUpdateInput = {};

  if (email) updateData.email = email;
  if (name) updateData.name = name;
  if (profile) updateData.profile = profile;
  if (whatsappId !== undefined) updateData.whatsappId = whatsappId === null ? null : Number(whatsappId);


  if (password) {
    updateData.passwordHash = await bcrypt.hash(password, 8);
  }

  if (queueIds) {
    updateData.userQueues = {
      // Primero eliminar las asociaciones existentes no incluidas en la nueva lista
      deleteMany: {
        userId: currentUserData.id,
        queueId: { notIn: queueIds }
      },
      // Luego crear las nuevas asociaciones (o conectar si se prefiere un enfoque de upsert)
      // Usar createMany o un bucle de create para evitar problemas con IDs duplicados si se usa connect y ya existe.
      // O más simple: set para reemplazar todas las conexiones.
      // Para `set`, Prisma espera una lista de `UserQueueWhereUniqueInput`.
      // Esto es más complejo que en Sequelize. Una forma es `disconnect` y luego `connect`.
      // O, si la lógica de negocio es reemplazar todas las colas:
      // 1. Disconnect all. 2. Connect new ones.
      // Por simplicidad y para replicar $set, usaremos disconnect y connect.
      // Esto requiere que `currentUserData.userQueues` esté disponible.
      // ShowUserService debería proveerlo como `userQueues` en lugar de `queues` mapeado.
      // Ajustaremos ShowUserService o asumiremos que tenemos los IDs de las colas actuales.

      // Estrategia: desconectar todas las colas actuales y conectar las nuevas.
      // Esto es más simple de implementar con Prisma que un "set" directo de IDs.
      disconnect: currentUserData.queues?.map(q => ({ userId_queueId: { userId: currentUserData.id, queueId: q.id } })),
      connect: queueIds.map(id => ({ userId_queueId: { userId: currentUserData.id, queueId: id } }))
    };
    // Nota: La estrategia anterior para `userQueues` con `disconnect` y `connect` asume que `userId_queueId` es la PK compuesta en `UserQueue`.
    // Si la PK es solo un `id` autoincrementado en `UserQueue`, la lógica de `disconnect` necesitaría los IDs de `UserQueue`.
    // Revisando el schema.prisma, UserQueue tiene @@id([userId, queueId]), así que el enfoque es correcto.
    // Sin embargo, Prisma espera que `connect` sea una lista de `UserQueueCreateWithoutUserInput[]` o similar.
    // La forma más idiomática para "set" es:
    // 1. Borrar todas las UserQueue para este usuario.
    // 2. Crear nuevas UserQueue.
    // Esto se puede hacer en una transacción o directamente si el ORM lo permite.
    // O usar `set` en la relación si Prisma lo soporta directamente para IDs.
    // Prisma: `queues: { set: queueIds.map(id => ({ id })) }` si la relación fuera directa muchos-a-muchos sin tabla de unión explícita.
    // Con tabla de unión explícita `UserQueue`:
    updateData.userQueues = {
        deleteMany: { userId: currentUserData.id }, // Elimina todas las asociaciones existentes
        create: queueIds.map(id => ({ // Crea las nuevas
            queue: { connect: { id } }
        }))
    };
  }


  const updatedUserRaw = await prisma.user.update({
    where: { id: currentUserData.id },
    data: updateData,
    include: {
      userQueues: { include: { queue: true } },
      whatsapp: true
    }
  });

  const userWithQueues = {
    ...updatedUserRaw,
    queues: updatedUserRaw.userQueues.map(uq => uq.queue)
  };

  return SerializeUser(userWithQueues as any);
};

export default UpdateUserService;
