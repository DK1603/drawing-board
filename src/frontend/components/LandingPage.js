import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/landingPage.css';

const LandingPage = () => {
  return (
    <div className="landing-container">
      {/* Top-right corner for login/sign up */}
      <div className="top-right-buttons">
        <Link to="/login" className="btn login-btn">Login</Link>
        <Link to="/signup" className="btn signup-btn">Sign Up</Link>
      </div>

      {/* Main content */}
      <div className="landing-content">
        <h1>Welcome to the Collaborative Drawing Board</h1>
        <p>
          This platform enhances interactive learning by allowing students and instructors to collaborate in real-time on a virtual drawing board.
          With features like real-time drawing, annotation, session management, and AI-powered clarifications, this project aims to fill the gap left by discontinued platforms like Google Jamboard.
        </p>
      </div>
    </div>
  );
};

export default LandingPage;
