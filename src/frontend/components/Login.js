// src/frontend/components/Login.js

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import firebaseApp from '../services/firebase-config';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore'; // Import Firestore methods
import '@fortawesome/fontawesome-free/css/all.min.css';
import styles from '../styles/auth_style.module.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp); // Initialize Firestore
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    setEmailError(''); 
    setPasswordError(''); 

    // Input Validation
    if (!email) {
      setEmailError('Enter email');
      setIsLoading(false);
      return;
    }
    if (!password) {
      setPasswordError('Enter password');
      setIsLoading(false);
      return;
    }

    try {
      // Sign in with Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('User signed in:', user);

      // **Fetch user document from Firestore**
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        console.log('User document retrieved:', userDoc.data());
        // Optionally, store user data in global state or context
      } else {
        console.warn('No user document found. Creating one now.');
        // **Create user document if it doesn't exist**
        await setDoc(userDocRef, {
          email: user.email,
          displayName: user.displayName || '',
          createdAt: new Date(),
        });
        console.log('User document created in Firestore.');
      }

      // Redirect to dashboard after successful login
      navigate('/dashboard');
    } catch (error) {
      console.error('Error logging in:', error);
      if (error.code === 'auth/wrong-password') {
        setErrorMessage('Wrong password');
      } else if (error.code === 'auth/user-not-found') {
        setErrorMessage('User not found');
      } else if (error.code === 'auth/invalid-email') {
        setErrorMessage('Invalid email address');
      } else {
        setErrorMessage('Wrong email or password');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (e.target.value.includes('@')) {
      setEmailError('');
    }
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (e.target.value) {
      setPasswordError('');
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prevShowPassword) => !prevShowPassword);
  };

  // **Optional:** Handle authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        console.log('User is already logged in:', currentUser);
        navigate('/dashboard');
      }
    });

    return () => unsubscribe();
  }, [auth, navigate]);

  return (
    <div className={styles.authPage}>
      <div className={styles.wrapper}>
        <h2 className={styles.title}>Welcome back!</h2>
        
        <form className={styles.form} onSubmit={handleLogin} noValidate>
          <div className={`${styles.inputField} ${emailError ? styles.errorInput : ''}`}>
            <input
              type="email"
              id="email"
              autoComplete="off"
              value={email}
              onChange={handleEmailChange}
              placeholder=" "
            />
            <label htmlFor="email">Email</label>
          </div>
          {emailError && <p className={styles.error}>{emailError}</p>}

          <div className={`${styles.inputField} ${passwordError ? styles.errorInput : ''}`}>
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder=" "
            />
            <label htmlFor="password">Password</label>
            <span
              className={styles.togglePassword}
              onClick={togglePasswordVisibility}
            >
              <i className={showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
            </span>
          </div>
          {passwordError && <p className={styles.error}>{passwordError}</p>}

          {errorMessage && <p className={styles.error}>{errorMessage}</p>}

          <button className={styles.button} type="submit" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
          <div className={styles.register}>
            Don’t have an account? <a href="/signup" className={styles.wrapperLink}>Sign Up</a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
