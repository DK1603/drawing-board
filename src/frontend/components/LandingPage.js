import React from 'react';
import { Link } from 'react-router-dom';
import styles from '../styles/landing.module.css';

const LandingPage = () => {
  return (
    <div className={styles.landingContainer}>
      <div className={styles.topRightButtons}>
        <Link to="/login" className={`${styles.btn} ${styles.loginBtn}`}>Login</Link>
        <Link to="/signup" className={`${styles.btn} ${styles.signupBtn}`}>Sign Up</Link>
      </div>

      <div className={styles.landingContent}>
        <h1 className={styles.title}>Welcome to the Collaborative Drawing Board</h1>
        <p className={styles.description}>
          A unique platform that empowers students and instructors to collaborate in real-time on a virtual drawing board.
          Featuring real-time drawing, annotations, AI-powered assistance, and much more, this board enhances interactive learning.
        </p>
      </div>

      <div className={styles.featureSection}>
        <h2 className={styles.sectionTitle}>Why Choose Us?</h2>
        <div className={styles.features}>
          <div className={styles.feature}>
            <h3>Real-Time Collaboration</h3>
            <p>Instant drawing and annotation for seamless teamwork.</p>
          </div>
          <div className={styles.feature}>
            <h3>Session Management</h3>
            <p>Organize sessions easily for structured learning experiences.</p>
          </div>
          <div className={styles.feature}>
            <h3>AI-Powered Assistance</h3>
            <p>Get clarifications and suggestions powered by AI.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;

