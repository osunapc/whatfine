import { PrismaClient } from "../generated/prisma";

/**
 * Cliente de Prisma para interactuar con la base de datos.
 *
 * Prisma Client es un constructor de consultas auto-generado y type-safe
 * que se genera a partir de tu esquema de Prisma.
 */
const prisma = new PrismaClient({
  // Opciones de configuración del cliente de Prisma, si son necesarias.
  // Por ejemplo, para logging:
  // log: ['query', 'info', 'warn', 'error'],
});

export default prisma;
