-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "nextInvoiceNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "nextQuoteNumber" INTEGER NOT NULL DEFAULT 1;
