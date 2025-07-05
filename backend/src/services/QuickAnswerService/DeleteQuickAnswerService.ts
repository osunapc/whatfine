import prisma from "../../database";
import AppError from "../../errors/AppError";

/**
 * Servicio para eliminar una respuesta rápida por su ID.
 * @param id El ID de la respuesta rápida a eliminar.
 * @returns Una promesa que se resuelve cuando la respuesta rápida ha sido eliminada.
 * @throws AppError si la respuesta rápida no se encuentra o si el ID es inválido.
 */
const DeleteQuickAnswerService = async (id: string): Promise<void> => {
  const quickAnswerId = parseInt(id, 10);

  if (isNaN(quickAnswerId)) {
    throw new AppError("ERR_INVALID_QUICK_ANSWER_ID", 400);
  }

  const quickAnswer = await prisma.quickAnswer.findUnique({
    where: { id: quickAnswerId }
  });

  if (!quickAnswer) {
    throw new AppError("ERR_NO_QUICK_ANSWER_FOUND", 404);
  }

  await prisma.quickAnswer.delete({
    where: { id: quickAnswerId }
  });
};

export default DeleteQuickAnswerService;
