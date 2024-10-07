import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';  // Import useNavigate for redirection
import firebaseApp from '../services/firebase-config';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import styles from '../styles/auth_style.module.css';  // Import the CSS module

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false); 
  const auth = getAuth(firebaseApp);
  const navigate = useNavigate();  // Initialize navigate for programmatic navigation

  const handleLogin = (e) => {
    e.preventDefault();
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        console.log('User logged in:', userCredential.user);
        setIsLoggedIn(true);

        // Show a pop-up message
        window.alert('Login successful! Redirecting to the boards page...');

        // Redirect to the boards page
        navigate('/boards');
      })
      .catch((error) => {
        console.error('Error logging in:', error);
        window.alert('Login failed. Please check your credentials.');
      });
  };

  if (isLoggedIn) { 
    return (
      <div className={styles.welcomeContainer}>
        <h1 className={styles.welcomeMessage}>Welcome to the Shared board!</h1>
      </div>
    );
  }

  return (
    <div className={styles.authPage}>
      <div className={styles.wrapper}>
        <h2 className={styles.title}>Login</h2>
        <form className={styles.form} onSubmit={handleLogin}>
          <div className={styles.inputField}>
            <input
              type="email"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder=" "
            />
            <label htmlFor="email">Email</label>
          </div>
          <div className={styles.inputField}>
            <input
              type="password"
              id="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=" "
            />
            <label htmlFor="password">Password</label>
          </div>
          <button className={styles.button} type="submit">Login</button>
        </form>
      </div>
    </div>
  );
}

export default Login;
