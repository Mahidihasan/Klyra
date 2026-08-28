import React, { useState } from 'react';
import { ArrowRight, Search, Sparkles } from 'lucide-react';

interface HeroBannerProps {
  onSearchSubmit: (term: string) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  onSearchSubmit,
}) => {
  const [inputVal, setInputVal] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchSubmit(inputVal);
  };

  return (
    <div className="hero-container">

      {/* =========================================
          BACKGROUND GLOW
      ========================================= */}
      <div className="hero-mesh-bg" />


      {/* =========================================
          LEFT CONTENT
      ========================================= */}
      <div className="hero-content">

        <div className="welcome-badge">
          <span>WELCOME BACK</span>
          <span className="wave-emoji">👋</span>
        </div>

        <h1 className="hero-heading">
          Discover. Test. Integrate.
        </h1>

        <p className="hero-subtext">
          Explore the best APIs, test them in real-time,
          and build powerful integrations with ease.
        </p>

      </div>


      {/* =========================================
          RIGHT ORBITAL GRAPHIC
      ========================================= */}
      <div className="hero-graphic-container">

        {/* =========================================
            RING 1
        ========================================= */}
        <div className="orbital-ring ring-1">

          <span className="orbit-ball ball-1" />
          <span className="orbit-ball ball-2" />

        </div>


        {/* =========================================
            RING 2
        ========================================= */}
        <div className="orbital-ring ring-2">

          <span className="orbit-ball ball-3" />
          <span className="orbit-ball ball-4" />
          <span className="orbit-ball ball-5" />

        </div>


        {/* =========================================
            RING 3
        ========================================= */}
        <div className="orbital-ring ring-3">

          <span className="orbit-ball ball-6" />
          <span className="orbit-ball ball-7" />
          <span className="orbit-ball ball-8" />

        </div>


        {/* =========================================
            CENTER API CUBE
        ========================================= */}
        <div className="api-cube-wrapper">

          <div className="api-cube">

            {/* FRONT */}
            <div className="cube-face cube-front">
              <span className="cube-text">
                API
              </span>
            </div>

            {/* BACK */}
            <div className="cube-face cube-back" />

            {/* RIGHT */}
            <div className="cube-face cube-right" />

            {/* LEFT */}
            <div className="cube-face cube-left">
              <span className="cube-text">
                API
              </span>
            </div>

            {/* TOP */}
            <div className="cube-face cube-top" />

            {/* BOTTOM */}
            <div className="cube-face cube-bottom">
              <span className="cube-text">
                API
              </span>
            </div>

          </div>

        </div>

      </div>


      {/* =========================================
          STYLES
      ========================================= */}
      <style>{`

        /* =========================================
           HERO CONTAINER
        ========================================= */

        .hero-container {
          position: relative;

          background:
            linear-gradient(
              135deg,
              #181533 0%,
              #15122b 50%,
              #0e0f1d 100%
            );

          border:
            1px solid
            rgba(139, 92, 246, 0.25);

          border-radius:
            var(--radius-xl, 24px);

          padding:
            4px 24px;

          display: flex;

          align-items: center;

          justify-content: space-between;

          overflow: hidden;

          box-shadow:
            0 8px 32px
            rgba(0, 0, 0, 0.4);
        }


        /* =========================================
           BACKGROUND MESH
        ========================================= */

        .hero-mesh-bg {
          position: absolute;

          top: -50%;
          right: -10%;

          width: 500px;
          height: 500px;

          background:
            radial-gradient(
              circle,
              rgba(139, 92, 246, 0.22) 0%,
              rgba(99, 102, 241, 0.08) 50%,
              transparent 70%
            );

          filter: blur(25px);

          pointer-events: none;
        }


        /* =========================================
           HERO CONTENT
        ========================================= */

        .hero-content {
          position: relative;

          z-index: 2;

          max-width: 540px;
        }


        /* =========================================
           WELCOME BADGE
        ========================================= */

        .welcome-badge {
          display: inline-flex;

          align-items: center;

          gap: 6px;

          font-size: 10px;

          font-weight: 700;

          letter-spacing: 0.08em;

          color: #c4b5fd;

          margin-bottom: 4px;
        }


        .wave-emoji {
          font-size: 13px;
        }


        /* =========================================
           HEADING
        ========================================= */

        .hero-heading {
          font-size: 18px;

          font-weight: 800;

          color: #ffffff;

          line-height: 1.1;

          margin-bottom: 3px;

          letter-spacing: -0.02em;
        }


        /* =========================================
           SUBTEXT
        ========================================= */

        .hero-subtext {
          font-size: 11px;

          color: #94a3b8;

          line-height: 1.4;

          margin-bottom: 3px;
        }


        /* =========================================
           ORBITAL GRAPHIC CONTAINER
        ========================================= */

        .hero-graphic-container {
          position: relative;

          width: 180px;

          height: 108px;

          display: flex;

          align-items: center;

          justify-content: center;

          flex-shrink: 0;
        }


        /* =========================================
           ORBITAL RINGS
        ========================================= */

        .orbital-ring {
          position: absolute;

          left: 50%;
          top: 50%;

          border-radius: 50%;

          transform-origin: center center;

          pointer-events: none;

          /*
             IMPORTANT:
             The ring itself is rotated.
             The balls inside inherit this rotation,
             so their elliptical orbit also rotates.
          */

          border:
            1.5px solid
            rgba(167, 139, 250, 0.25);

          box-shadow:
            0 0 20px
            rgba(139, 92, 246, 0.08);
        }


        /* =========================================
           RING 1
        ========================================= */

        .ring-1 {

          width: 171px;
          height: 74px;

          transform:
            translate(-50%, -50%)
            rotate(-30deg);

          border-color:
            rgba(139, 92, 246, 0.38);

          z-index: 3;
        }


        /* =========================================
           RING 2
        ========================================= */

        .ring-2 {

          width: 243px;
          height: 108px;

          transform:
            translate(-50%, -50%)
            rotate(-30deg);

          border-color:
            rgba(99, 102, 241, 0.27);

          z-index: 2;
        }


        /* =========================================
           RING 3
        ========================================= */

        .ring-3 {

          width: 315px;
          height: 144px;

          transform:
            translate(-50%, -50%)
            rotate(-30deg);

          border-color:
            rgba(167, 139, 250, 0.16);

          z-index: 1;
        }


        /* =========================================
           ORBITING BALLS
        ========================================= */

        .orbit-ball {

          position: absolute;

          left: 50%;
          top: 50%;

          border-radius: 50%;

          pointer-events: none;

          /*
             The ball starts at the exact center.
             Its animation translates it to the
             perimeter of the ellipse.
          */

          transform-origin: center center;

          background:
            radial-gradient(
              circle at 30% 25%,
              #ffffff 0%,
              #ddd6fe 20%,
              #a78bfa 48%,
              #7c3aed 78%,
              #4f46e5 100%
            );

          box-shadow:
            0 0 7px
            rgba(196, 181, 253, 0.95),

            0 0 14px
            rgba(139, 92, 246, 0.75),

            0 0 25px
            rgba(99, 102, 241, 0.45);

          z-index: 20;

          will-change: transform;
        }


        /* =========================================
           BALL SIZES
        ========================================= */

        .ball-1,
        .ball-2 {

          width: 7px;
          height: 7px;

          margin-left: -3.5px;
          margin-top: -3.5px;
        }


        .ball-3,
        .ball-4,
        .ball-5 {

          width: 8px;
          height: 8px;

          margin-left: -4px;
          margin-top: -4px;
        }


        .ball-6,
        .ball-7,
        .ball-8 {

          width: 6px;
          height: 6px;

          margin-left: -3px;
          margin-top: -3px;
        }


        /* =========================================
           RING 1 ORBIT
           
           Ring:
           width  = 171px
           height = 74px

           Radius:
           X = 85.5px
           Y = 37px
        ========================================= */

        .ball-1 {

          animation:
            orbit-small
            5s
            linear
            infinite;
        }


        .ball-2 {

          animation:
            orbit-small
            5s
            linear
            infinite;

          animation-delay:
            -2.5s;
        }


        @keyframes orbit-small {

          0% {
            transform:
              translate(85.5px, 0);
          }

          6.25% {
            transform:
              translate(79.1px, 14.2px);
          }

          12.5% {
            transform:
              translate(60.5px, 26.2px);
          }

          18.75% {
            transform:
              translate(32.7px, 34.1px);
          }

          25% {
            transform:
              translate(0, 37px);
          }

          31.25% {
            transform:
              translate(-32.7px, 34.1px);
          }

          37.5% {
            transform:
              translate(-60.5px, 26.2px);
          }

          43.75% {
            transform:
              translate(-79.1px, 14.2px);
          }

          50% {
            transform:
              translate(-85.5px, 0);
          }

          56.25% {
            transform:
              translate(-79.1px, -14.2px);
          }

          62.5% {
            transform:
              translate(-60.5px, -26.2px);
          }

          68.75% {
            transform:
              translate(-32.7px, -34.1px);
          }

          75% {
            transform:
              translate(0, -37px);
          }

          81.25% {
            transform:
              translate(32.7px, -34.1px);
          }

          87.5% {
            transform:
              translate(60.5px, -26.2px);
          }

          93.75% {
            transform:
              translate(79.1px, -14.2px);
          }

          100% {
            transform:
              translate(85.5px, 0);
          }
        }


        /* =========================================
           RING 2 ORBIT
           
           Width  = 243px
           Height = 108px

           Radius:
           X = 121.5px
           Y = 54px
        ========================================= */

        .ball-3 {

          animation:
            orbit-medium
            7s
            linear
            infinite;
        }


        .ball-4 {

          animation:
            orbit-medium
            7s
            linear
            infinite;

          animation-delay:
            -2.33s;
        }


        .ball-5 {

          animation:
            orbit-medium
            7s
            linear
            infinite;

          animation-delay:
            -4.66s;
        }


        @keyframes orbit-medium {

          0% {
            transform:
              translate(121.5px, 0);
          }

          6.25% {
            transform:
              translate(112.4px, 20.7px);
          }

          12.5% {
            transform:
              translate(85.9px, 38.2px);
          }

          18.75% {
            transform:
              translate(46.4px, 49.9px);
          }

          25% {
            transform:
              translate(0, 54px);
          }

          31.25% {
            transform:
              translate(-46.4px, 49.9px);
          }

          37.5% {
            transform:
              translate(-85.9px, 38.2px);
          }

          43.75% {
            transform:
              translate(-112.4px, 20.7px);
          }

          50% {
            transform:
              translate(-121.5px, 0);
          }

          56.25% {
            transform:
              translate(-112.4px, -20.7px);
          }

          62.5% {
            transform:
              translate(-85.9px, -38.2px);
          }

          68.75% {
            transform:
              translate(-46.4px, -49.9px);
          }

          75% {
            transform:
              translate(0, -54px);
          }

          81.25% {
            transform:
              translate(46.4px, -49.9px);
          }

          87.5% {
            transform:
              translate(85.9px, -38.2px);
          }

          93.75% {
            transform:
              translate(112.4px, -20.7px);
          }

          100% {
            transform:
              translate(121.5px, 0);
          }
        }


        /* =========================================
           RING 3 ORBIT
           
           Width  = 315px
           Height = 144px

           Radius:
           X = 157.5px
           Y = 72px
        ========================================= */

        .ball-6 {

          animation:
            orbit-large
            10s
            linear
            infinite;
        }


        .ball-7 {

          animation:
            orbit-large
            10s
            linear
            infinite;

          animation-delay:
            -3.33s;
        }


        .ball-8 {

          animation:
            orbit-large
            10s
            linear
            infinite;

          animation-delay:
            -6.66s;
        }


        @keyframes orbit-large {

          0% {
            transform:
              translate(157.5px, 0);
          }

          6.25% {
            transform:
              translate(145.7px, 27.5px);
          }

          12.5% {
            transform:
              translate(111.3px, 50.9px);
          }

          18.75% {
            transform:
              translate(60.2px, 66.5px);
          }

          25% {
            transform:
              translate(0, 72px);
          }

          31.25% {
            transform:
              translate(-60.2px, 66.5px);
          }

          37.5% {
            transform:
              translate(-111.3px, 50.9px);
          }

          43.75% {
            transform:
              translate(-145.7px, 27.5px);
          }

          50% {
            transform:
              translate(-157.5px, 0);
          }

          56.25% {
            transform:
              translate(-145.7px, -27.5px);
          }

          62.5% {
            transform:
              translate(-111.3px, -50.9px);
          }

          68.75% {
            transform:
              translate(-60.2px, -66.5px);
          }

          75% {
            transform:
              translate(0, -72px);
          }

          81.25% {
            transform:
              translate(60.2px, -66.5px);
          }

          87.5% {
            transform:
              translate(111.3px, -50.9px);
          }

          93.75% {
            transform:
              translate(145.7px, -27.5px);
          }

          100% {
            transform:
              translate(157.5px, 0);
          }
        }


        /* =========================================
           CENTER CUBE
        ========================================= */

        .api-cube-wrapper {

          position: absolute;

          left: 50%;
          top: 50%;

          transform:
            translate(-50%, -50%);

          perspective: 900px;

          z-index: 10;

          animation:
            floatCube
            5s
            ease-in-out
            infinite;
        }


        /* =========================================
           SMALLER 3D CUBE
        ========================================= */

        .api-cube {

          width: 52px;
          height: 52px;

          position: relative;

          transform-style:
            preserve-3d;

          transform:
            rotateX(20deg)
            rotateY(30deg);

          transition:
            transform 0.3s ease;
        }


        .api-cube:hover {

          transform:
            rotateX(25deg)
            rotateY(45deg);
        }


        /* =========================================
           CUBE FACES
        ========================================= */

        .cube-face {

          position: absolute;

          width: 52px;
          height: 52px;

          border-radius: 8px;

          border:
            1px solid
            rgba(255, 255, 255, 0.2);

          display: flex;

          align-items: center;

          justify-content: center;

          backface-visibility:
            visible;

          box-shadow:

            inset
            0 2px 4px
            rgba(255, 255, 255, 0.2),

            0 6px 16px
            rgba(124, 58, 237, 0.4);
        }


        /* =========================================
           FRONT
        ========================================= */

        .cube-front {

          transform:
            translateZ(26px);

          background:
            linear-gradient(
              145deg,
              #8b5cf6,
              #6366f1
            );
        }


        /* =========================================
           BACK
        ========================================= */

        .cube-back {

          transform:
            rotateY(180deg)
            translateZ(26px);

          background:
            linear-gradient(
              145deg,
              #4f46e5,
              #4338ca
            );
        }


        /* =========================================
           RIGHT
        ========================================= */

        .cube-right {

          transform:
            rotateY(90deg)
            translateZ(26px);

          background:
            linear-gradient(
              145deg,
              #7c3aed,
              #6d28d9
            );
        }


        /* =========================================
           LEFT
        ========================================= */

        .cube-left {

          transform:
            rotateY(-90deg)
            translateZ(26px);

          background:
            linear-gradient(
              145deg,
              #6366f1,
              #4f46e5
            );
        }


        /* =========================================
           TOP
        ========================================= */

        .cube-top {

          transform:
            rotateX(90deg)
            translateZ(26px);

          background:
            linear-gradient(
              145deg,
              #a78bfa,
              #7c3aed
            );
        }


        /* =========================================
           BOTTOM
        ========================================= */

        .cube-bottom {

          transform:
            rotateX(-90deg)
            translateZ(26px);

          background:
            linear-gradient(
              145deg,
              #4f46e5,
              #3730a3
            );
        }


        /* =========================================
           CUBE TEXT
        ========================================= */

        .cube-text {

          font-size: 12px;

          font-weight: 800;

          color: white;

          letter-spacing: 0.5px;

          text-shadow:
            0 2px 8px
            rgba(0, 0, 0, 0.35);
        }


        .cube-front .cube-text {

          font-size: 13px;
        }


        /* =========================================
           CUBE FLOAT
        ========================================= */

        @keyframes floatCube {

          0%,
          100% {
            margin-top: 0;
          }

          50% {
            margin-top: -8px;
          }
        }


        /* =========================================
           RESPONSIVE
        ========================================= */

        @media (max-width: 900px) {

          .hero-graphic-container {
            display: none;
          }
        }


        @media (max-width: 640px) {

          .hero-heading {
            font-size: 24px;
          }

          .hero-container {
            padding:
              28px 24px;
          }
        }

      `}</style>

    </div>
  );
};