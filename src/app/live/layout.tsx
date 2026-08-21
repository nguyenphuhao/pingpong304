import { AutoRefresh } from "./_AutoRefresh";
import { LiveBottomNav } from "./_LiveBottomNav";
import { LiveTopBar } from "./_LiveTopBar";

export default function LiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LiveTopBar />
      <main className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 pt-3 md:max-w-3xl md:gap-4 md:px-5 lg:max-w-5xl">
        {children}
        <AutoRefresh />
      </main>
      <LiveBottomNav />
    </>
  );
}
