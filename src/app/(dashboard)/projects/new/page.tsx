import { redirect } from "next/navigation";

export default async function NewProjectPage() {
  redirect("/projects?create=true");
}
