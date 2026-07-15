import SiteHeader from "@/components/SiteHeader";
import DailyMysteryGame from "@/components/daily-mystery/DailyMysteryGame";

type ArchivePuzzlePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ArchivePuzzlePage({ params }: ArchivePuzzlePageProps) {
  const { slug } = await params;

  return (
    <>
      <SiteHeader />
      <main>
        <DailyMysteryGame initialMode="archive" archiveSlug={slug} />
      </main>
    </>
  );
}
