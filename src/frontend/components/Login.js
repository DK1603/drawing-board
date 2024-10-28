import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import firebaseApp from '../services/firebase-config';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import styles from '../styles/auth_style.module.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const auth = getAuth(firebaseApp);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setIsLoading(true);
    signInWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
        const token = await userCredential.user.getIdToken();
        localStorage.setItem('token', token);
        window.alert('Login successful! Redirecting to the Dashboard...');
        navigate('/dashboard');
      })
      .catch((error) => {
        window.alert('Login failed: ' + error.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
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
          type={showPassword ? 'text' : 'password'}
          id="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder=" "
        />
        <label htmlFor="password">Password</label>
        <span
          onClick={togglePasswordVisibility}
          className={styles.togglePassword}
          role="button"
          aria-label="Toggle password visibility"
        >
          <i className={showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
        </span>
      </div>

      

      <button className={styles.button} type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
      <div className={styles.register}>
        Don't have an account? <a href="/signup" className={styles.wrapperLink}>Sign Up</a>
      </div>
    </form>
  </div>
</div>

  );
}

export default Login;
