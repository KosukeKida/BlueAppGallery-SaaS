import Link from 'next/link';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Link href="/">
            <img src="/logo-gallery.svg" alt="Blue App Gallery" className="h-10 w-auto" />
          </Link>
        </div>
      </header>
      <main className="container mx-auto py-8 px-4">
        {children}
      </main>
    </div>
  );
}
