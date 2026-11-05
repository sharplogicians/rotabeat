import { PrismaClient } from "@prisma/client"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env

const hostedDatabaseUrl =
  DB_HOST && DB_PORT && DB_NAME && DB_USER && DB_PASSWORD
    ? `mysql://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${encodeURIComponent(DB_NAME)}`
    : undefined

// Allow the host to select the OpenSSL 3 engine if Prisma's runtime detection falls back to 1.1.
if (process.env.PRISMA_USE_MUSL_OPENSSL_3 === "1" && !process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  const appRequire = createRequire(join(process.cwd(), "package.json"))
  const prismaRequire = createRequire(appRequire.resolve("@prisma/client"))
  const generatedClientDir = dirname(prismaRequire.resolve(".prisma/client/package.json"))
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = join(
    generatedClientDir,
    "libquery_engine-linux-musl-openssl-3.0.x.so.node",
  )
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: hostedDatabaseUrl,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
