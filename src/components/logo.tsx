import Image from "next/image";

type LogoProps = {
  className?: string;
  variant?: "full" | "mark";
  width?: number;
  height?: number;
};

/**
 * Brand logo for cuochop.
 * - variant="full" (default): logo với text
 * - variant="mark": chỉ icon, dùng cho favicon/avatar
 */
export function Logo({
  className,
  variant = "full",
  width = 120,
  height = 40,
}: LogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src="/favicon.png"
        alt="cuochop"
        width={32}
        height={32}
        className={className}
        priority
      />
    );
  }

  return (
    <Image
      src="/logo-small.png"
      alt="cuochop"
      width={width}
      height={height}
      className={className}
      priority
    />
  );
}
