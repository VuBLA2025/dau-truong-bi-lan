import React, { useEffect, useState } from 'react';

export const STAGE_W = 1080;
export const STAGE_H = 1920;

export const StageFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const handleResize = () => {
      const scaleW = window.innerWidth / STAGE_W;
      const scaleH = window.innerHeight / STAGE_H;
      setScale(Math.min(scaleW, scaleH));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      style={{
        width: STAGE_W * scale,
        height: STAGE_H * scale,
      }}
      className="relative overflow-hidden shadow-2xl flex items-center justify-center bg-black"
    >
      <div
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
        className="absolute left-0 top-0 overflow-hidden"
      >
        {children}
      </div>
    </div>
  );
};
