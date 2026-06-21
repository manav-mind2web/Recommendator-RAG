import { Chat } from "@/components/Chat";
import { Disclaimer } from "@/components/Disclaimer";

export default function Home() {
  return (
    <main className="app">
      <header className="app-header">
        <h1>Grounded Listings Assistant</h1>
        <p>
          Recommends only from a fixed directory of 18 local listings. It never
          invents places and refuses to drift off-topic.
        </p>
      </header>
      <Disclaimer />
      <Chat />
    </main>
  );
}
