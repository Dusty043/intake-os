import { redirect } from "next/navigation";

export default function NewIntakePage() {
  redirect("/discovery");
  return null;
}
