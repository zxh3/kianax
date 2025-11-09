import Chat from "@kianax/web/components/demo/Chat";
import { SignOut } from "@kianax/web/components/auth/sign-out";

export default function DashboardPage() {
  return (
    <div>
      <SignOut />
      <Chat />
    </div>
  );
}
