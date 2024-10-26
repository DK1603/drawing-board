import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import firebaseApp from '../services/firebase-config';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import styles from '../styles/auth_style.module.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);  // Loading state
  const auth = getAuth(firebaseApp);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setIsLoading(true);  // Show loading while login is processing

    signInWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
        console.log('User logged in:', userCredential.user);

        // Get Firebase token to store for backend verification
        const token = await userCredential.user.getIdToken();
        localStorage.setItem('token', token);  // Store the token in localStorage

        window.alert('Login successful! Redirecting to the Dashboard...');
        navigate('/dashboard');  // Redirect to Dashboard page
      })
      .catch((error) => {
        console.error('Error logging in:', error);
        window.alert('Login failed: ' + error.message);  // Display error to the user
      })
      .finally(() => {
        setIsLoading(false);  // Hide loading indicator after login process
      });
  };

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
          <button className={styles.button} type="submit" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
