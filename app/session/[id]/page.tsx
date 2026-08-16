import { loadSessionData } from "./session-data";
import SessionScreen from "./session-screen";

export const dynamic = "force-dynamic";

interface SessionPageProps {
  params: Promise<{ id: string }>;
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { id } = await params;
  const data = await loadSessionData(id);

  return <SessionScreen initialData={data} sessionId={id} />;
}