"use client";

import { useEffect, useRef, useState } from "react";
import type { TypewriterSpeed } from "@/types";

interface TypewriterTextProps {
  /** 需要逐字显示的文本 */
  text: string;
  /** 打字速度，决定每个字的延迟 */
  speed?: TypewriterSpeed;
  /** 打字完成后的回调 */
  onComplete?: () => void;
  /** 附加的 className */
  className?: string;
}

/** 不同速度对应的单字延迟（毫秒） */
const SPEED_DELAY: Record<TypewriterSpeed, number> = {
  slow: 80,
  medium: 40,
  fast: 15,
};

/**
 * 打字机效果组件：逐字显示文本，末尾带闪烁光标。
 * 当 text 或 speed 发生变化时会自动从头开始播放。
 */
export default function TypewriterText({
  text,
  speed = "medium",
  onComplete,
  className,
}: TypewriterTextProps) {
  // count = 当前已显示的字符数；displayed/done 均由其派生，无需额外 state
  const [count, setCount] = useState(0);

  // 用 ref 持有最新的 onComplete，避免把它放进 effect 依赖导致重播
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // text / speed 变化时重置：采用「渲染期间调整 state」范式
  // （React 官方推荐，等价于用 key 重置，但不触发 set-state-in-effect）
  const [resetKey, setResetKey] = useState({ text, speed });
  if (resetKey.text !== text || resetKey.speed !== speed) {
    setResetKey({ text, speed });
    setCount(0);
  }

  const displayed = text.slice(0, count);
  const done = count >= text.length;

  // 驱动逐字动画：未完成则安排下一字，完成则触发一次回调
  useEffect(() => {
    if (done) {
      onCompleteRef.current?.();
      return;
    }
    const timer = setTimeout(() => {
      setCount((c) => c + 1);
    }, SPEED_DELAY[speed]);
    return () => clearTimeout(timer);
  }, [count, done, speed, text]);

  return (
    <span className={className}>
      {displayed}
      {!done && <span className="typewriter-cursor" aria-hidden="true" />}
    </span>
  );
}
