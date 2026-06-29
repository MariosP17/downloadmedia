import { useState, useEffect } from "react";

export default function FallbackImage({
  src,
  alt,
  fallback = "/no-poster-16-9.jpg",
  className,
  ...props
}: any) {
  const [imgSrc, setImgSrc] = useState(src);

  useEffect(() => {
    // Client-side verification loop:
    // If a link updates after mounting, verify it natively
    if (src && src !== fallback) {
      const img = new Image();
      img.src = src;
      img.onload = () => setImgSrc(src);
      img.onerror = () => setImgSrc(fallback);
    } else {
      setImgSrc(src);
    }
  }, [src, fallback]);

  return (
    <img
      {...props}
      src={imgSrc || fallback}
      alt={alt}
      className={className}
      onError={() => {
        // React-layer backup listener
        if (imgSrc !== fallback) {
          setImgSrc(fallback);
        }
      }}
    />
  );
}