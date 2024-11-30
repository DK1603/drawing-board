// src/frontend/components/SignUp.js

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import firebaseApp from '../services/firebase-config';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore'; // Import Firestore methods
import '@fortawesome/fontawesome-free/css/all.min.css';
import styles from '../styles/auth_style.module.css';

function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmErrorMessage, setConfirmErrorMessage] = useState('');
  
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp); // Initialize Firestore
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setEmailError('');
    setPasswordError('');
    setConfirmErrorMessage('');

    // Input Validation
    if (!email) {
      setEmailError('Enter email');
      return;
    }
    if (!password) {
      setPasswordError('Enter password');
      return;
    }
    if (!confirmPassword) {
      setConfirmErrorMessage('Confirm your password');
      return;
    }
    if (password !== confirmPassword) {
      setConfirmErrorMessage("Passwords don't match!");
      return;
    }

    try {
      // Create user with Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('User registered:', user);

      // **Create Firestore document for the new user**
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        displayName: '', // Initialize with empty string or prompt user to set it later
        createdAt: new Date(),
      });
      console.log('User document created in Firestore.');

      // Show success modal
      setShowModal(true);
    } catch (error) {
      console.error('Error registering user:', error);
      if (error.code === 'auth/email-already-in-use') {
        setErrorMessage('This email is already associated with an account.');
      } else if (error.code === 'auth/invalid-email') {
        setErrorMessage('Invalid email address.');
      } else if (error.code === 'auth/weak-password') {
        setErrorMessage('Password should be at least 6 characters.');
      } else {
        setErrorMessage('Error registering user: ' + error.message);
      }
    }
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (value.includes('@')) {
      setEmailError('');
    }
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    if (value) {
      setPasswordError('');
    }
  };

  const handleConfirmPasswordChange = (e) => {
    const value = e.target.value;
    setConfirmPassword(value);
    if (value === password) {
      setConfirmErrorMessage('');
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword((prevShowPassword) => !prevShowPassword);
  };

  const handleModalClose = () => {
    setShowModal(false);
    navigate('/login');
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.wrapper}>
        <h2 className={styles.title}>Sign Up</h2>
        <form className={styles.form} onSubmit={handleSignUp} noValidate>
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

          <div className={`${styles.inputField} ${confirmErrorMessage ? styles.errorInput : ''}`}>
            <input
              type="password"
              id="confirm-password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              placeholder=" "
            />
            <label htmlFor="confirm-password">Confirm Password</label>
          </div>
          {confirmErrorMessage && <p className={styles.error}>{confirmErrorMessage}</p>}

          <button className={styles.button} type="submit">Sign Up</button>
          
          {errorMessage && <p className={styles.error}>{errorMessage}</p>}
        </form>

        <div className={styles.loginRedirect}>
          Already have an account?{' '}
          <button className={styles.loginButton} onClick={() => navigate('/login')}>Go to Login</button>
        </div>
      </div>

      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Registration Successful!</h3>
            <p>Your account has been created. Click OK to proceed to the login page.</p>
            <button onClick={handleModalClose} className={styles.modalButton}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SignUp;
