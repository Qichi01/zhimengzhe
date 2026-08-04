"use client";

import Image from "next/image";
import type { CharacterAvatar as CharacterAvatarAsset } from "@/types";

interface CharacterAvatarProps {
  name: string;
  color: string;
  avatar?: CharacterAvatarAsset | null;
  size?: number;
  className?: string;
}

export default function CharacterAvatar({
  name,
  color,
  avatar,
  size = 48,
  className = "",
}: CharacterAvatarProps) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: color,
        boxShadow: `0 0 ${Math.round(size / 3)}px ${color}40`,
      }}
      aria-label={`${name}的头像`}
    >
      {avatar?.dataUrl ? (
        <Image
          src={avatar.dataUrl}
          alt={`${name}的头像`}
          fill
          sizes={`${size}px`}
          className="object-cover"
          unoptimized
        />
      ) : (
        <span
          className="absolute inset-0 flex items-center justify-center font-bold text-white"
          style={{ fontSize: Math.max(14, Math.round(size * 0.36)) }}
        >
          {name.trim().charAt(0) || "?"}
        </span>
      )}
    </div>
  );
}
