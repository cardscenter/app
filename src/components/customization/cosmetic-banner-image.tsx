import { prisma } from "@/lib/prisma";
import Image from "next/image";

interface CosmeticBannerImageProps {
  bannerKey: string;
}

export async function CosmeticBannerImage({ bannerKey }: CosmeticBannerImageProps) {
  const item = await prisma.cosmeticItem.findUnique({
    where: { key: bannerKey },
    select: { assetPath: true, name: true },
  });

  if (!item?.assetPath) {
    return (
      <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
        🖼️
      </div>
    );
  }

  return (
    <Image
      src={item.assetPath}
      alt={item.name}
      fill
      className="object-cover"
      sizes="(max-width: 1280px) 100vw, 1280px"
    />
  );
}
