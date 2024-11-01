import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import firebaseApp from '../services/firebase-config';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import '@fortawesome/fontawesome-free/css/all.min.css';
import styles from '../styles/auth_style.module.css';

function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [setErrorMessage] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmErrorMessage, setConfirmErrorMessage] = useState('');
  const auth = getAuth(firebaseApp);
  const navigate = useNavigate();

  const handleSignUp = (e) => {
    e.preventDefault();
    setErrorMessage('');
    setEmailError('');
    setPasswordError('');
    setConfirmErrorMessage('');

    // Custom validation for empty fields
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

    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        console.log('User registered:', userCredential.user);
        setShowModal(true);
      })
      .catch((error) => {
        if (error.code === 'auth/email-already-in-use') {
          setErrorMessage('This email is already associated with an account.');
        } else {
          setErrorMessage('Error registering user: ' + error.message);
        }
      });
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
