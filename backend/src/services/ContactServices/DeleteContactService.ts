import prisma from "../../database";
import AppError from "../../errors/AppError";

/**
 * Servicio para eliminar un contacto por su ID.
 * Esto también eliminará en cascada los campos personalizados asociados
 * si la base de datos y el esquema de Prisma están configurados para ello (lo cual es el comportamiento por defecto de Prisma para relaciones uno-a-muchos si no se especifica lo contrario).
 * @param id El ID del contacto a eliminar.
 * @returns Una promesa que se resuelve cuando el contacto ha sido eliminado.
 * @throws AppError si el contacto no se encuentra o si el ID es inválido.
 */
const DeleteContactService = async (id: string): Promise<void> => {
  const contactId = parseInt(id, 10);

  if (isNaN(contactId)) {
    throw new AppError("ERR_INVALID_CONTACT_ID", 400);
  }

  // Primero, asegurarse de que el contacto exista antes de intentar eliminarlo.
  const contact = await prisma.contact.findUnique({
    where: { id: contactId }
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  // Eliminar los ContactCustomField asociados primero para evitar errores de restricción de clave foránea
  // si la cascada no está configurada o no funciona como se espera.
  // Prisma, por defecto, en MySQL para relaciones opcionales (como contactId en ContactCustomField podría ser si no fuera requerido)
  // usaría SET NULL en onDelete si no se especifica CASCADE.
  // Dado que contactId es obligatorio en ContactCustomField, y no hemos definido onDelete explícitamente,
  // es más seguro eliminar los campos personalizados manualmente o asegurarse de que la BD tenga ON DELETE CASCADE.
  // Para el esquema actual, donde ContactCustomField tiene una relación directa con Contact,
  // Prisma debería manejar la eliminación en cascada si la relación está bien definida y es obligatoria.
  // Sin embargo, para ser explícitos y evitar problemas, se pueden eliminar primero.

  // Si la relación en `schema.prisma` para `ContactCustomField` (`contact Contact @relation(fields: [contactId], references: [id])`)
  // no tiene un `@relation(onDelete: Cascade)`, es más seguro hacer esto:
  await prisma.contactCustomField.deleteMany({
    where: { contactId: contactId }
  });

  // Luego eliminar el contacto
  await prisma.contact.delete({
    where: { id: contactId }
  });
};

export default DeleteContactService;
