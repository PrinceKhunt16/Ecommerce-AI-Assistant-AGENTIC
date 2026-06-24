import { Suspense } from "react";
import { ConversationsPage } from "@/components/conversations/conversations-page";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ConversationsPage />
    </Suspense>
  );
}
