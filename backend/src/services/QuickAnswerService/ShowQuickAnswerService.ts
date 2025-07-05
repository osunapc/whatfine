import prisma from "../../database";
import AppError from "../../errors/AppError";
import { QuickAnswer } from "../../generated/prisma";

/**
 * Servicio para obtener una respuesta rápida específica por su ID.
 * @param id El ID de la respuesta rápida a obtener.
 * @returns Una promesa que se resuelve a la respuesta rápida encontrada.
 * @throws AppError si la respuesta rápida no se encuentra.
 */
const ShowQuickAnswerService = async (id: string): Promise<QuickAnswer> => {
  // El ID en el modelo es Int, así que convertimos el string a número.
  const quickAnswerId = parseInt(id, 10);

  if (isNaN(quickAnswerId)) {
    throw new AppError("ERR_INVALID_QUICK_ANSWER_ID", 400);
  }

  const quickAnswer = await prisma.quickAnswer.findUnique({
    where: { id: quickAnswerId }
  });

  if (!quickAnswer) {
    throw new AppError("ERR_NO_QUICK_ANSWERS_FOUND", 404);
  }

  return quickAnswer;
};

export default ShowQuickAnswerService;
