import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { loadSettings } from "@/lib/actions/settings";
import SettingsPage from "@/components/SettingsPage";

export default async function Settings() {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const settings = await loadSettings();

  return <SettingsPage initialSettings={settings} />;
}
