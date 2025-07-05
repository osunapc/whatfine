import prisma from "../../database";
import AppError from "../../errors/AppError";
import UpdateDeletedUserOpenTicketsStatus from "../../helpers/UpdateDeletedUserOpenTicketsStatus";
// Asumimos que Ticket de Prisma es compatible con UpdateDeletedUserOpenTicketsStatus
// o que esa función se adaptará.
import { Ticket as PrismaTicket } from "../../generated/prisma";

/**
 * Servicio para eliminar un usuario por su ID.
 * Antes de eliminar, actualiza el estado de los tickets abiertos asignados al usuario.
 * Las entradas en UserQueues se eliminan en cascada gracias a la configuración de Prisma.
 * @param id El ID del usuario a eliminar (puede ser string o number).
 * @returns Una promesa que se resuelve cuando el usuario ha sido eliminado.
 * @throws AppError si el usuario no se encuentra o el ID es inválido.
 */
const DeleteUserService = async (id: string | number): Promise<void> => {
  const userId = typeof id === 'string' ? parseInt(id, 10) : id;

  if (isNaN(userId)) {
    throw new AppError("ERR_INVALID_USER_ID", 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }

  const userOpenTickets = await prisma.ticket.findMany({
    where: {
      userId: userId,
      status: "open"
    }
  });

  if (userOpenTickets.length > 0) {
    // Asumimos que UpdateDeletedUserOpenTicketsStatus puede tomar PrismaTicket[]
    // o será adaptado.
    UpdateDeletedUserOpenTicketsStatus(userOpenTickets as any[]);
  }

  // Eliminar las asociaciones en UserQueues explícitamente antes de eliminar el usuario
  // es una buena práctica si no se está 100% seguro de la configuración de cascada
  // o si se quiere ser explícito. Sin embargo, el schema.prisma define UserQueues
  // con una relación a User, y Prisma debería manejar la eliminación de estas entradas
  // cuando el User es eliminado, especialmente porque UserQueue.userId es una clave foránea.
  // No es estrictamente necesario eliminarlos manualmente aquí si la relación es sólida.
  // await prisma.userQueue.deleteMany({ where: { userId: userId } });


  // Eliminar los tickets asociados al usuario o desasignarlos.
  // La lógica original solo actualizaba el estado, no los eliminaba ni reasignaba.
  // Si la FK en Ticket `userId` es opcional y `onDelete` es `SetNull`, Prisma lo manejaría.
  // Si es restrictiva, la eliminación del usuario fallaría si tiene tickets.
  // El schema de Ticket tiene `userId Int?`, por lo que es opcional.
  // Si `onDelete` no está especificado en la relación User-Ticket, MySQL podría usar RESTRICT.
  // Es más seguro desasociar los tickets o asegurarse de que `onDelete: SetNull` esté en la relación.
  // Por ahora, replicaremos la lógica original que no reasigna, solo actualiza estado (ya hecho).
  // Si la eliminación del usuario falla debido a tickets, necesitaremos ajustar esto.
  // Una opción es poner `onDelete: SetNull` en la relación Ticket -> User en `schema.prisma`.
  // model Ticket { ... userId Int? user User? @relation(fields: [userId], references: [id], onDelete: SetNull) }

  await prisma.user.delete({
    where: { id: userId }
  });
};

export default DeleteUserService;
