"use client";

import { useState } from "react";
import Image from "next/image";

export default function FallbackImage({
  src,
  alt,
  fallback = "/no-poster.jpg",
  className,
  ...props
}: any) {
  const [imgSrc, setImgSrc] = useState(src);

  return (
    <img
        src={imgSrc || fallback}
        alt={alt}
        className={className}
        onError={(e) => {
            e.currentTarget.src = fallback;
        }}
/>
  );
}