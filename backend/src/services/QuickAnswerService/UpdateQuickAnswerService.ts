import prisma from "../../database";
import AppError from "../../errors/AppError";
import { QuickAnswer } from "../../generated/prisma";

/**
 * Interfaz para los datos a actualizar en una respuesta rápida.
 * Todos los campos son opcionales.
 */
interface QuickAnswerData {
  /** Nuevo atajo para la respuesta rápida. */
  shortcut?: string;
  /** Nuevo mensaje para la respuesta rápida. */
  message?: string;
}

/**
 * Interfaz para la solicitud del servicio de actualización de respuestas rápidas.
 */
interface Request {
  /** Datos a actualizar en la respuesta rápida. */
  quickAnswerData: QuickAnswerData;
  /** ID de la respuesta rápida a actualizar. */
  quickAnswerId: string;
}

/**
 * Servicio para actualizar una respuesta rápida existente.
 * @param quickAnswerData Objeto con los campos a actualizar (shortcut, message).
 * @param quickAnswerId ID de la respuesta rápida a modificar.
 * @returns Una promesa que se resuelve a la respuesta rápida actualizada.
 * @throws AppError si la respuesta rápida no se encuentra o si el ID es inválido.
 */
const UpdateQuickAnswerService = async ({
  quickAnswerData,
  quickAnswerId
}: Request): Promise<QuickAnswer> => {
  const id = parseInt(quickAnswerId, 10);

  if (isNaN(id)) {
    throw new AppError("ERR_INVALID_QUICK_ANSWER_ID", 400);
  }

  // Verifica primero si la respuesta rápida existe
  const existingQuickAnswer = await prisma.quickAnswer.findUnique({
    where: { id }
  });

  if (!existingQuickAnswer) {
    throw new AppError("ERR_NO_QUICK_ANSWERS_FOUND", 404);
  }

  // Si se proporciona un nuevo 'shortcut', verifica que no esté duplicado
  if (quickAnswerData.shortcut && quickAnswerData.shortcut !== existingQuickAnswer.shortcut) {
    const shortcutExists = await prisma.quickAnswer.findFirst({
      where: {
        shortcut: quickAnswerData.shortcut,
        id: { not: id } // Excluir la respuesta rápida actual de la búsqueda
      }
    });
    if (shortcutExists) {
      throw new AppError("ERR__SHORTCUT_DUPLICATED");
    }
  }

  const updatedQuickAnswer = await prisma.quickAnswer.update({
    where: { id },
    data: quickAnswerData
  });

  return updatedQuickAnswer;
};

export default UpdateQuickAnswerService;
