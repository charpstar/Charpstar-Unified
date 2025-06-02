import { notFound } from "next/navigation";

export default function ProductDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!params.id) return notFound();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Product Detail</h1>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-8">
        <p>
          Product ID: <b>{params.id}</b>
        </p>
        <p>Product details coming soon!</p>
      </div>
    </div>
  );
}
