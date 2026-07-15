import SiteHeader from "@/components/SiteHeader";
import DailyMysteryGame from "@/components/daily-mystery/DailyMysteryGame";

export const metadata = {
  title: "The Hidden Chronicle | Lore Studio",
  description: "A daily Runeterra lore deduction game.",
};

export default function DailyMysteryPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <DailyMysteryGame initialMode="daily" />
      </main>
    </>
  );
}
