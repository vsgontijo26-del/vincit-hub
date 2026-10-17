import { redirect } from "next/navigation";
export default async function Old({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const q = new URLSearchParams({ tab: "criar", ...(await searchParams) });
  redirect(`/creator/laboratorio?${q}`);
}
