"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  z: number;       // 深度（用于视差）
  size: number;
  opacity: number;
  twinkle: number;  // 闪烁速度
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface StarfieldBackgroundProps {
  /** 星星密度：sparse(稀疏) / normal(正常) / dense(密集) */
  density?: "sparse" | "normal" | "dense";
  /** 是否显示流星 */
  showShootingStars?: boolean;
  className?: string;
}

const DENSITY_MAP = {
  sparse: 80,
  normal: 150,
  dense: 250,
};

/**
 * 星空粒子背景
 * - 星星闪烁动效
 * - 偶发流星
 * - 鼠标视差
 */
export default function StarfieldBackground({
  density = "normal",
  showShootingStars = true,
  className,
}: StarfieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let stars: Star[] = [];
    let shootingStars: ShootingStar[] = [];
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initStars();
    };

    const initStars = () => {
      const count = Math.floor(
        (canvas.width * canvas.height * DENSITY_MAP[density]) /
          (1920 * 1080)
      );
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        z: Math.random() * 0.8 + 0.2,
        size: Math.random() * 1.5 + 0.3,
        opacity: Math.random() * 0.6 + 0.3,
        twinkle: Math.random() * 0.02 + 0.005,
      }));
    };

    const spawnShootingStar = () => {
      const startX = Math.random() * canvas.width;
      const startY = Math.random() * canvas.height * 0.5;
      const angle = (Math.random() * 30 + 20) * (Math.PI / 180);
      const speed = Math.random() * 4 + 6;
      shootingStars.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 60 + Math.random() * 40,
      });
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 鼠标视差平滑
      mouseX += (targetMouseX - mouseX) * 0.03;
      mouseY += (targetMouseY - mouseY) * 0.03;

      // 绘制星星
      for (const star of stars) {
        const twinkleOffset = Math.sin(Date.now() * star.twinkle) * 0.3;
        const opacity = Math.max(0.1, star.opacity + twinkleOffset);
        const offsetX = mouseX * star.z * 15;
        const offsetY = mouseY * star.z * 15;

        ctx.beginPath();
        ctx.arc(
          star.x + offsetX,
          star.y + offsetY,
          star.size * star.z,
          0,
          Math.PI * 2
        );
        ctx.fillStyle = `rgba(232, 213, 245, ${opacity})`;
        ctx.fill();

        // 大星星加光晕
        if (star.size > 1.2) {
          ctx.beginPath();
          ctx.arc(
            star.x + offsetX,
            star.y + offsetY,
            star.size * star.z * 2.5,
            0,
            Math.PI * 2
          );
          const gradient = ctx.createRadialGradient(
            star.x + offsetX,
            star.y + offsetY,
            0,
            star.x + offsetX,
            star.y + offsetY,
            star.size * star.z * 2.5
          );
          gradient.addColorStop(0, `rgba(200, 170, 255, ${opacity * 0.3})`);
          gradient.addColorStop(1, "rgba(200, 170, 255, 0)");
          ctx.fillStyle = gradient;
          ctx.fill();
        }
      }

      // 绘制流星
      if (showShootingStars) {
        // 随机生成流星
        if (Math.random() < 0.003 && shootingStars.length < 2) {
          spawnShootingStar();
        }

        for (let i = shootingStars.length - 1; i >= 0; i--) {
          const s = shootingStars[i];
          s.x += s.vx;
          s.y += s.vy;
          s.life++;

          const lifeRatio = s.life / s.maxLife;
          const alpha = lifeRatio < 0.5 ? lifeRatio * 2 : (1 - lifeRatio) * 2;

          // 流星尾迹
          const trailLength = 80;
          const speed = Math.hypot(s.vx, s.vy);
          const gradient = ctx.createLinearGradient(
            s.x,
            s.y,
            s.x - s.vx * trailLength / speed,
            s.y - s.vy * trailLength / speed
          );
          gradient.addColorStop(0, `rgba(232, 213, 245, ${alpha})`);
          gradient.addColorStop(0.5, `rgba(200, 170, 255, ${alpha * 0.5})`);
          gradient.addColorStop(1, "rgba(200, 170, 255, 0)");

          ctx.strokeStyle = gradient;
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(
            s.x - s.vx * trailLength / Math.hypot(s.vx, s.vy),
            s.y - s.vy * trailLength / Math.hypot(s.vx, s.vy)
          );
          ctx.stroke();

          // 流星头部
          ctx.beginPath();
          ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.fill();

          if (s.life >= s.maxLife || s.x > canvas.width || s.y > canvas.height) {
            shootingStars.splice(i, 1);
          }
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [density, showShootingStars]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none fixed inset-0 ${className ?? ""}`}
      style={{ zIndex: 0 }}
    />
  );
}
