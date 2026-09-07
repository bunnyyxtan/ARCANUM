"use client";

import { SettingsPageContent } from "./_components/settings-page-content";
import { useSettingsController } from "./_hooks/use-settings-controller";

export default function SettingsPage() {
  const settings = useSettingsController();
  return <SettingsPageContent settings={settings} />;
}
