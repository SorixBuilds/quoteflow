import { redirect } from "next/navigation";

/** Catalog index → Services (the most-used catalog screen). */
export default function CatalogIndexPage() {
  redirect("/catalog/services");
}
