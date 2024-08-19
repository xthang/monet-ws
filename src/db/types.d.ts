import prisma from './index.ts'

type PrismaClient = typeof prisma

// type PrismaTransactionClient = Prisma.TransactionClient
type PrismaTransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]
