import React, { useEffect } from "react";
import { Link } from "react-router-dom";

const LandingPage = () => {

  // Custom Cursor Effect
  useEffect(() => {
    const cursor = document.querySelector(".custom-cursor");
    const moveCursor = (e) => {
      if (cursor) {
        cursor.style.left = e.clientX + "px";
        cursor.style.top = e.clientY + "px";
      }
    };
    window.addEventListener("mousemove", moveCursor);
    return () => window.removeEventListener("mousemove", moveCursor);
  }, []);

  return (
    <div className="landing-container">
      <style>{`
        .landing-container {
          height: 100vh;
          overflow: hidden;
          position: relative;
          font-family: 'DM Sans', sans-serif;
          color: white;
        }

        /* Background Video */
        .bg-video {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: -1;
        }

        /* Dark Overlay */
        .landing-container::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(2,6,23,0.9), rgba(15,23,42,0.85));
          z-index: -2;
        }

        /* Glow Effect */
        .landing-container::after {
          content: "";
          position: absolute;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(34,211,238,0.3), transparent 70%);
          top: -100px;
          left: -100px;
          filter: blur(150px);
          animation: glowMove 8s infinite alternate ease-in-out;
          z-index: -1;
        }

        @keyframes glowMove {
          from { transform: translateY(-40px); }
          to { transform: translateY(40px); }
        }

        /* Custom Cursor */
        .custom-cursor {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: rgba(34,211,238,0.8);
          position: fixed;
          pointer-events: none;
          transform: translate(-50%, -50%);
          transition: 0.1s ease-out;
          box-shadow: 0 0 20px rgba(34,211,238,0.8);
          z-index: 9999;
        }

        .content-wrapper {
          position: relative;
          z-index: 1;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        nav {
          display: flex;
          justify-content: space-between;
          padding: 1.5rem 3rem;
          align-items: center;
        }

        .logo {
          font-size: 1.7rem;
          font-weight: 800;
        }

        .gradient-text {
          background: linear-gradient(90deg, #22d3ee, #a78bfa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          flex: 1;
          padding: 0 2rem;
        }

        .hero h1 {
          font-size: 4rem;
          font-weight: 800;
          line-height: 1.1;
          animation: fadeUp 1s ease forwards;
        }

        .hero p {
          margin-top: 1.5rem;
          color: #cbd5e1;
          font-size: 1.1rem;
          max-width: 700px;
          margin-inline: auto;
          animation: fadeUp 1.4s ease forwards;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .buttons {
          margin-top: 2rem;
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .btn {
          padding: 0.9rem 2rem;
          border-radius: 12px;
          font-weight: 700;
          text-decoration: none;
          transition: 0.3s ease;
        }

        .btn-primary {
          background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          color: #0f172a;
        }

        .btn-primary:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 30px rgba(34,211,238,0.5);
        }

        .btn-secondary {
          background: rgba(255,255,255,0.1);
          color: white;
          border: 1px solid rgba(255,255,255,0.2);
        }

        .btn-secondary:hover {
          background: rgba(255,255,255,0.2);
          transform: translateY(-4px);
        }

        footer {
          text-align: center;
          padding: 1rem;
          font-size: 0.85rem;
          color: #94a3b8;
        }
      `}</style>

      {/* Background Video */}
      <video
        className="bg-video"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="/bg.mp4" type="video/mp4" />
      </video>

      {/* Cursor */}
      <div className="custom-cursor"></div>

      <div className="content-wrapper">
        <nav>
          <div className="logo">
            Health<span className="gradient-text">DSS</span>
          </div>
          <Link to="/login" className="btn btn-primary">Login</Link>
        </nav>

        <div className="hero">
          <div>
            <h1>
              Smarter Healthcare <br />
              <span className="gradient-text">Powered by AI</span>
            </h1>

            <p>
              Advanced AI-based Clinical Decision Support System helping healthcare
              workers and doctors make faster, smarter and life-saving decisions.
            </p>

            <div className="buttons">
              <Link to="/login" className="btn btn-primary">🚀 Get Started</Link>
              <Link to="/register" className="btn btn-secondary">Create Account</Link>
            </div>
          </div>
        </div>

        <footer>
          © {new Date().getFullYear()} HealthDSS • AI Clinical Decision Support
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;